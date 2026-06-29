const { City, State } = require('country-state-city');

console.log('Total states in IN:', State.getStatesOfCountry('IN').length);
const cities = City.getCitiesOfCountry('IN');
console.log('Total cities in IN:', cities.length);
if (cities.length > 0) {
  console.log('First 5 cities:', cities.slice(0, 5));
}
