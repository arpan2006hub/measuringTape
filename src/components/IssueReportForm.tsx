/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { z } from 'zod';
import { useIssueStore } from '@/measuringTape/src/store/useIssueStore';
import { useUserStore } from '@/measuringTape/src/store/useUserStore';
import { IssueCategory, GPSLocation } from '@/measuringTape/src/types/issue';
import { ISSUE_CATEGORIES } from '@/measuringTape/src/constants';
import IssueMap from './IssueMap';
import ImageUploader from './ImageUploader';
import { 
  AlertTriangle, 
  CheckCircle2, 
  MapPin, 
  FileText, 
  Tag, 
  Building, 
  Image as ImageIcon,
  ChevronRight,
  ArrowRight,
  Info,
  ThumbsUp,
  X
} from 'lucide-react';

// Form validation schema using Zod
const reportSchema = z.object({
  title: z.string()
    .min(5, { message: 'Title must be at least 5 characters.' })
    .max(100, { message: 'Title cannot exceed 100 characters.' }),
  description: z.string()
    .min(10, { message: 'Description must be at least 10 characters.' })
    .max(1000, { message: 'Description cannot exceed 1000 characters.' }),
  category: z.nativeEnum(IssueCategory),
  localityId: z.string().min(1, { message: 'Please select a locality.' }),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  localImagePreview: z.string().min(1, { message: 'An evidence photo is required.' }),
});

type ReportFormValues = z.infer<typeof reportSchema>;

interface IssueReportFormProps {
  onSuccess: (draftId: string) => void;
}

export default function IssueReportForm({ onSuccess }: IssueReportFormProps) {
  const { saveDraft, checkDuplicate, supportIssue } = useIssueStore();
  const { currentUser } = useUserStore();

  const [formValues, setFormValues] = useState<Partial<ReportFormValues>>({
    title: '',
    description: '',
    category: undefined,
    localityId: '',
    latitude: 12.9715987,
    longitude: 77.5945627,
    localImagePreview: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof ReportFormValues, string>>>({});
  const [duplicateWarning, setDuplicateWarning] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync default values when user is loaded
  useEffect(() => {
    if (currentUser && currentUser.subscribedLocalities && currentUser.subscribedLocalities.length > 0) {
      const defaultLoc = currentUser.subscribedLocalities[0];
      setFormValues(prev => ({
        ...prev,
        localityId: prev.localityId || defaultLoc.id,
        latitude: prev.localityId ? prev.latitude : defaultLoc.centerLocation.latitude,
        longitude: prev.localityId ? prev.longitude : defaultLoc.centerLocation.longitude,
      }));
    }
  }, [currentUser]);

  // Sync coordinates when locality is changed
  const handleLocalityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedLocalityId = e.target.value;
    const selectedLocality = currentUser?.subscribedLocalities.find(loc => loc.id === selectedLocalityId);
    
    if (selectedLocality) {
      setFormValues(prev => ({
        ...prev,
        localityId: selectedLocalityId,
        latitude: selectedLocality.centerLocation.latitude,
        longitude: selectedLocality.centerLocation.longitude
      }));
      // Clear errors related to locality
      if (errors.localityId) {
        setErrors(prev => {
          const next = { ...prev };
          delete next.localityId;
          return next;
        });
      }
    }
  };

  // Map coordinate updates
  const handleCoordinateChange = (loc: GPSLocation) => {
    setFormValues(prev => ({
      ...prev,
      latitude: loc.latitude,
      longitude: loc.longitude
    }));
  };

  const handleImageChange = (base64String: string | undefined) => {
    setFormValues(prev => ({
      ...prev,
      localImagePreview: base64String || ''
    }));
    if (errors.localImagePreview) {
      setErrors(prev => {
        const next = { ...prev };
        delete next.localImagePreview;
        return next;
      });
    }
  };

  const validateForm = (): boolean => {
    const result = reportSchema.safeParse(formValues);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof ReportFormValues, string>> = {};
      result.error.issues.forEach(err => {
        const path = err.path[0] as keyof ReportFormValues;
        fieldErrors[path] = err.message;
      });
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  const handleSubmit = async (e: React.FormEvent, ignoreDuplicate = false) => {
    e.preventDefault();
    if (!validateForm()) return;

    // Check for duplicate locally (Category identical + Distance <= 100 meters)
    const duplicate = checkDuplicate(formValues.category, {
      latitude: formValues.latitude,
      longitude: formValues.longitude
    });

    if (duplicate && !ignoreDuplicate) {
      setDuplicateWarning(duplicate);
      return;
    }

    setIsSubmitting(true);
    try {
      const reporterAddress = currentUser?.address || '0xCustodialCitizenAddress';
      
      // Post reporting data and base64 image to the server-side proxy
      const response = await fetch('/api/ipfs/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formValues.title,
          description: formValues.description,
          category: formValues.category,
          locality: formValues.localityId,
          latitude: formValues.latitude,
          longitude: formValues.longitude,
          image: formValues.localImagePreview,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to pin resources to IPFS.');
      }

      const { imageCID, metadataCID } = await response.json();

      let txHash = "";
      let onChainId: number | undefined;

      try {
        const bcResponse = await fetch('/api/blockchain/create-issue', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ metadataCID }),
        });
        if (bcResponse.ok) {
          const bcData = await bcResponse.json();
          txHash = bcData.txHash;
          onChainId = bcData.issueId;
        }
      } catch (bcErr) {
        console.error('Blockchain submission failed:', bcErr);
      }

      const draftId = await saveDraft({
        title: formValues.title!,
        description: formValues.description!,
        category: formValues.category!,
        locality: formValues.localityId!,
        location: {
          latitude: formValues.latitude!,
          longitude: formValues.longitude!
        },
        localImagePreview: formValues.localImagePreview,
        reporterAddress,
        metadataCid: metadataCID,
        imageCid: imageCID,
        blockchainTxHash: txHash,
        onChainId,
      });

      onSuccess(draftId);
    } catch (err: any) {
      console.error('[Upload Workflow Error]', err);
      alert(err.message || 'An error occurred during decentralized compilation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSupportDuplicate = async () => {
    if (duplicateWarning) {
      const citizenAddress = currentUser?.address || '0xCustodialCitizenAddress';
      await supportIssue(duplicateWarning.id, citizenAddress);
      alert(`Success! You have added your upvote to the existing issue: "${duplicateWarning.title}"`);
      setDuplicateWarning(null);
      // Reset form or navigate
      setFormValues({
        title: '',
        description: '',
        category: undefined,
        localityId: 'WARD_A',
        latitude: 12.9715987,
        longitude: 77.5945627,
        localImagePreview: '',
      });
    }
  };

  // Current selected locality object for map centering
  const currentLocalityObj = currentUser?.subscribedLocalities.find(l => l.id === formValues.localityId) || currentUser?.subscribedLocalities[0] || { id: '', name: 'Default', centerLocation: { latitude: 12.9715987, longitude: 77.5945627 }, boundaryRadiusMeters: 1500 };

  return (
    <div className="relative">
      <form onSubmit={(e) => handleSubmit(e)} className="space-y-6">
        
        {/* Step 1: Issue Identity */}
        <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
            <FileText className="w-4 h-4 text-rose-500" />
            <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider">
              1. Issue Information
            </h2>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5 uppercase">
              Issue Title
            </label>
            <input
              type="text"
              value={formValues.title}
              onChange={(e) => {
                setFormValues(prev => ({ ...prev, title: e.target.value }));
                if (errors.title) setErrors(prev => ({ ...prev, title: undefined }));
              }}
              placeholder="e.g. Broken water pipeline junction"
              className={`w-full px-3.5 py-2 text-sm bg-zinc-50 border rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all ${
                errors.title ? 'border-rose-500 bg-rose-50/20' : 'border-zinc-200'
              }`}
            />
            {errors.title && (
              <p className="text-xs font-medium text-rose-600 mt-1.5 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {errors.title}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5 uppercase">
              Description / Notes
            </label>
            <textarea
              value={formValues.description}
              onChange={(e) => {
                setFormValues(prev => ({ ...prev, description: e.target.value }));
                if (errors.description) setErrors(prev => ({ ...prev, description: undefined }));
              }}
              placeholder="Describe the physical condition of the issue in detail, noting any immediate dangers..."
              rows={4}
              className={`w-full px-3.5 py-2 text-sm bg-zinc-50 border rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all resize-none ${
                errors.description ? 'border-rose-500 bg-rose-50/20' : 'border-zinc-200'
              }`}
            />
            {errors.description && (
              <p className="text-xs font-medium text-rose-600 mt-1.5 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {errors.description}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5 uppercase">
                Category
              </label>
              <div className="relative">
                <select
                  value={formValues.category || ''}
                  onChange={(e) => {
                    setFormValues(prev => ({ ...prev, category: e.target.value as IssueCategory }));
                    if (errors.category) setErrors(prev => ({ ...prev, category: undefined }));
                  }}
                  className={`w-full px-3.5 py-2 text-sm bg-zinc-50 border rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all appearance-none cursor-pointer ${
                    errors.category ? 'border-rose-500 bg-rose-50/20' : 'border-zinc-200'
                  }`}
                >
                  <option value="" disabled>Select a Category</option>
                  {ISSUE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.replace('_', ' ')}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-2.5 pointer-events-none text-zinc-400">
                  <Tag className="w-4 h-4" />
                </div>
              </div>
              {errors.category && (
                <p className="text-xs font-medium text-rose-600 mt-1.5 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {errors.category}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5 uppercase">
                Target Locality Ward
              </label>
              <div className="relative">
                <select
                  value={formValues.localityId}
                  onChange={handleLocalityChange}
                  className="w-full px-3.5 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all appearance-none cursor-pointer"
                >
                  <option value="" disabled>Select Subscribed Ward</option>
                  {(currentUser?.subscribedLocalities || []).map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-2.5 pointer-events-none text-zinc-400">
                  <Building className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Step 2: Location Map */}
        <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-rose-500" />
              <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider">
                2. Precise Location
              </h2>
            </div>
            <span className="text-[10px] bg-rose-50 text-rose-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
              OSM Leaflet map
            </span>
          </div>

          <p className="text-xs text-zinc-500 leading-relaxed">
            The map is centered on <strong>{currentLocalityObj.name}</strong>. Drag the red pin or click anywhere on the map grid to lock the GPS location of the reported infrastructure failure.
          </p>

          <IssueMap
            location={{
              latitude: formValues.latitude || currentLocalityObj.centerLocation.latitude,
              longitude: formValues.longitude || currentLocalityObj.centerLocation.longitude,
            }}
            localityCenter={currentLocalityObj.centerLocation}
            onChange={handleCoordinateChange}
          />
        </div>

        {/* Step 3: Evidence Image Upload */}
        <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
            <ImageIcon className="w-4 h-4 text-rose-500" />
            <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider">
              3. Visual Evidence Photo
            </h2>
          </div>

          <p className="text-xs text-zinc-500 leading-relaxed">
            Provide an image proof showcasing the defect. This evidence will be bundled into the IPFS audit package for verification voting.
          </p>

          <ImageUploader
            previewUrl={formValues.localImagePreview}
            onChange={handleImageChange}
          />
          {errors.localImagePreview && (
            <p className="text-xs font-medium text-rose-600 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> {errors.localImagePreview}
            </p>
          )}
        </div>

        {/* Submit Draft Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-sm rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSubmitting ? 'Processing Audit Draft...' : 'Compile & Save Report Draft'}
            <ArrowRight className="w-4 h-4 text-zinc-300" />
          </button>
        </div>

      </form>

      {/* Duplicate Warning Modal Overlay */}
      {duplicateWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl border border-zinc-200 shadow-2xl p-6 relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setDuplicateWarning(null)}
              className="absolute top-4 right-4 p-1 rounded-full text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 bg-amber-50 rounded-full text-amber-500 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900">
                  Potential Duplicate Issue Detected!
                </h3>
                 <p className="text-xs text-zinc-500 mt-1">
                  Our Haversine spatial scanner matched another active issue of the same category within 100 meters.
                </p>
              </div>
            </div>

            {/* Duplicate Issue Box */}
            <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-200 text-sm mb-5">
              <span className="inline-block text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider mb-2">
                {duplicateWarning.category.replace('_', ' ')}
              </span>
              <h4 className="font-semibold text-zinc-800">{duplicateWarning.title}</h4>
              <p className="text-xs text-zinc-500 mt-1 line-clamp-2">
                {duplicateWarning.description}
              </p>
              <div className="flex items-center gap-1 text-[10px] font-semibold text-zinc-500 mt-3">
                <MapPin className="w-3.5 h-3.5 text-zinc-400" /> Location Offset: Under 100m
              </div>
            </div>

            <p className="text-xs text-zinc-500 leading-relaxed mb-6">
              To minimize community partition and prioritize resolution resources, you are encouraged to upvote/support the existing issue instead. You may also force the report if you are certain this is a separate incident.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-3">
              <button
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
              >
                Proceed with reporting anyway
              </button>
              <button
                type="button"
                onClick={handleSupportDuplicate}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-lg transition-colors shadow shadow-rose-600/10 cursor-pointer"
              >
                <ThumbsUp className="w-3.5 h-3.5" /> Support Existing Issue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
