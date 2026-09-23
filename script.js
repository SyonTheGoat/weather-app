const API_BASE = 'https://api.open-meteo.com/v1/forecast';
const GEOCODING_API = 'https://geocoding-api.open-meteo.com/v1/search';

const state = {
  unit: 'fahrenheit',
  location: { name: 'Detroit', admin1: 'Michigan', country: 'United States', latitude: 42.33, longitude: -83.05, timezone: 'America/Detroit' },
  weather: null
};

const regionAliases = {
  mi: { name: 'Michigan', admin1: 'Michigan', latitude: 42.7336, longitude: -84.5553, timezone: 'America/Detroit' },
  michigan: { name: 'Michigan', admin1: 'Michigan', latitude: 42.7336, longitude: -84.5553, timezone: 'America/Detroit' },
  ca: { name: 'California', admin1: 'California', latitude: 38.5767, longitude: -121.4944, timezone: 'America/Los_Angeles' },
  california: { name: 'California', admin1: 'California', latitude: 38.5767, longitude: -121.4944, timezone: 'America/Los_Angeles' },
  fl: { name: 'Florida', admin1: 'Florida', latitude: 30.4383, longitude: -84.2807, timezone: 'America/New_York' },
  florida: { name: 'Florida', admin1: 'Florida', latitude: 30.4383, longitude: -84.2807, timezone: 'America/New_York' },
  il: { name: 'Illinois', admin1: 'Illinois', latitude: 39.7984, longitude: -89.6544, timezone: 'America/Chicago' },
  illinois: { name: 'Illinois', admin1: 'Illinois', latitude: 39.7984, longitude: -89.6544, timezone: 'America/Chicago' },
  ny: { name: 'New York', admin1: 'New York', latitude: 42.6528, longitude: -73.7579, timezone: 'America/New_York' },
  'new york': { name: 'New York', admin1: 'New York', latitude: 42.6528, longitude: -73.7579, timezone: 'America/New_York' },
  tx: { name: 'Texas', admin1: 'Texas', latitude: 30.2672, longitude: -97.7431, timezone: 'America/Chicago' },
  texas: { name: 'Texas', admin1: 'Texas', latitude: 30.2672, longitude: -97.7431, timezone: 'America/Chicago' },
  wa: { name: 'Washington', admin1: 'Washington', latitude: 47.0379, longitude: -122.9007, timezone: 'America/Los_Angeles' },
  washington: { name: 'Washington', admin1: 'Washington', latitude: 47.0379, longitude: -122.9007, timezone: 'America/Los_Angeles' },
  us: { name: 'United States', admin1: '', latitude: 39.8283, longitude: -98.5795, timezone: 'America/Chicago' },
  usa: { name: 'United States', admin1: '', latitude: 39.8283, longitude: -98.5795, timezone: 'America/Chicago' },
  'united-states': { name: 'United States', admin1: '', latitude: 39.8283, longitude: -98.5795, timezone: 'America/Chicago' },
  canada: { name: 'Canada', admin1: '', latitude: 45.4215, longitude: -75.6972, timezone: 'America/Toronto' },
  uk: { name: 'United Kingdom', admin1: '', latitude: 51.5072, longitude: -0.1276, timezone: 'Europe/London' },
  'united-kingdom': { name: 'United Kingdom', admin1: '', latitude: 51.5072, longitude: -0.1276, timezone: 'Europe/London' },
  australia: { name: 'Australia', admin1: '', latitude: -35.2809, longitude: 149.13, timezone: 'Australia/Sydney' },
  india: { name: 'India', admin1: '', latitude: 28.6139, longitude: 77.209, timezone: 'Asia/Kolkata' },
  japan: { name: 'Japan', admin1: '', latitude: 35.6762, longitude: 139.6503, timezone: 'Asia/Tokyo' },
  mexico: { name: 'Mexico', admin1: '', latitude: 19.4326, longitude: -99.1332, timezone: 'America/Mexico_City' }
};

const $ = (selector) => document.querySelector(selector);
const fahrenheit = () => state.unit === 'fahrenheit';
let suggestionRequest = 0;
const STORAGE_KEY = 'atmos-weather-locations';

function readSavedLocations() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function locationKey(location) {
  return `${Number(location.latitude).toFixed(3)},${Number(location.longitude).toFixed(3)}`;
}

function saveLocationSearch(location) {
  const saved = readSavedLocations();
  const key = locationKey(location);
  const existing = saved.find((entry) => entry.key === key);
  if (existing) {
    existing.count += 1;
    existing.location = location;
  } else {
    saved.push({ key, count: 1, location });
  }
  saved.sort((first, second) => second.count - first.count);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved.slice(0, 20))); } catch { /* Storage may be unavailable. */ }
}

function getMostSearchedLocation() {
  return readSavedLocations()[0]?.location || state.location;
}

const weatherTypes = {
  0: ['Clear sky', '☀'], 1: ['Mainly clear', '◒'], 2: ['Partly cloudy', '◒'], 3: ['Overcast', '☁'],
  45: ['Foggy', '≋'], 48: ['Rime fog', '≋'], 51: ['Light drizzle', '☂'], 53: ['Drizzle', '☂'], 55: ['Heavy drizzle', '☂'],
  56: ['Freezing drizzle', '❄'], 57: ['Freezing drizzle', '❄'], 61: ['Light rain', '☂'], 63: ['Rain', '☂'], 65: ['Heavy rain', '☂'],
  66: ['Freezing rain', '❄'], 67: ['Freezing rain', '❄'], 71: ['Light snow', '❄'], 73: ['Snow', '❄'], 75: ['Heavy snow', '❄'],
  77: ['Snow grains', '❄'], 80: ['Rain showers', '☂'], 81: ['Rain showers', '☂'], 82: ['Heavy showers', '☂'],
  85: ['Snow showers', '❄'], 86: ['Snow showers', '❄'], 95: ['Thunderstorm', 'ϟ'], 96: ['Thunderstorm', 'ϟ'], 99: ['Thunderstorm', 'ϟ']
};

function weatherInfo(code) { return weatherTypes[code] || ['Changing conditions', '◌']; }
function temp(value) { return `${Math.round(value)}°`; }
function wind(value) { return `${Math.round(value)} ${fahrenheit() ? 'mph' : 'km/h'}`; }
function rain(value) { return `${Math.round(value)}%`; }
function timeLabel(iso, options = {}) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', ...options, timeZone: state.weather?.timezone || state.location.timezone }).format(new Date(iso));
}
function dayLabel(iso) { return new Intl.DateTimeFormat(undefined, { weekday: 'long', timeZone: state.weather?.timezone || state.location.timezone }).format(new Date(`${iso}T12:00:00`)); }
function shortDate(iso) { return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: state.weather?.timezone || state.location.timezone }).format(new Date(`${iso}T12:00:00`)); }
function setText(selector, value) { const element = $(selector); if (element) element.textContent = value; }

async function searchLocation(query) {
  const alias = regionAliases[query.trim().toLowerCase()];
  if (alias) return alias;
  const response = await fetch(`${GEOCODING_API}?name=${encodeURIComponent(query)}&count=1&language=en&format=json`);
  if (!response.ok) throw new Error('Could not search for that place.');
  const data = await response.json();
  if (!data.results?.length) throw new Error('No matching place found. Try a nearby city.');
  return data.results[0];
}

async function findLocations(query) {
  const response = await fetch(`${GEOCODING_API}?name=${encodeURIComponent(query)}&count=8&language=en&format=json`);
  if (!response.ok) throw new Error('Location search is temporarily unavailable.');
  return (await response.json()).results || [];
}

function hideSuggestions() { $('#locationSuggestions').classList.remove('visible'); $('#locationSuggestions').replaceChildren(); }
function showSuggestions(results) {
  const container = $('#locationSuggestions'); container.replaceChildren();
  results.forEach((result) => {
    const button = document.createElement('button'); button.className = 'location-suggestion'; button.type = 'button'; button.setAttribute('role', 'option');
    const title = document.createElement('strong'); title.textContent = result.name;
    const detail = document.createElement('span'); detail.textContent = [result.admin1, result.country].filter(Boolean).join(', ');
    button.append(title, detail); button.addEventListener('click', async () => { $('#locationInput').value = result.name; hideSuggestions(); await loadLocation(result); });
    container.append(button);
  });
  container.classList.toggle('visible', results.length > 0);
}

async function fetchWeather(location) {
  const params = new URLSearchParams({
    latitude: location.latitude, longitude: location.longitude, timezone: 'auto',
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m',
    hourly: 'temperature_2m,precipitation_probability,weather_code,wind_speed_10m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,sunrise,sunset',
    forecast_days: '7', wind_speed_unit: fahrenheit() ? 'mph' : 'kmh', temperature_unit: fahrenheit() ? 'fahrenheit' : 'celsius'
  });
  const response = await fetch(`${API_BASE}?${params}`);
  if (!response.ok) throw new Error('Weather data is temporarily unavailable.');
  return response.json();
}

function renderCurrent(data) {
  const current = data.current;
  const today = data.daily;
  const info = weatherInfo(current.weather_code);
  setText('#placeName', [state.location.name, state.location.admin1].filter(Boolean).join(', '));
  setText('#localTime', `${new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: data.timezone }).format(new Date(current.time))} local time`);
  setText('#updatedText', `Updated ${timeLabel(current.time)}`);
  setText('#currentIcon', info[1]); setText('#currentCondition', info[0]);
  setText('#currentTemp', Math.round(current.temperature_2m)); setText('#currentUnit', fahrenheit() ? '°F' : '°C');
  setText('#feelsLike', `${temp(current.apparent_temperature)}${fahrenheit() ? 'F' : 'C'}`);
  setText('#highLow', `${temp(today.temperature_2m_max[0])} / ${temp(today.temperature_2m_min[0])}`);
  setText('#currentPrecip', rain(current.precipitation_probability ?? 0)); setText('#currentWind', wind(current.wind_speed_10m));
  setText('#humidity', `${Math.round(current.relative_humidity_2m)}%`); $('#humidityBar').style.width = `${current.relative_humidity_2m}%`;
  const direction = compass(current.wind_direction_10m); setText('#windDirection', direction); setText('#windSpeed', wind(current.wind_speed_10m));
  $('#windArrow').style.transform = `rotate(${current.wind_direction_10m}deg)`;
  const uv = Math.round(today.uv_index_max[0] || 0); setText('#uvIndex', uv); setText('#uvLabel', uv < 3 ? 'low exposure' : uv < 6 ? 'moderate exposure' : 'high exposure');
  document.querySelectorAll('.uv-scale i').forEach((bar, index) => bar.classList.toggle('active', index < Math.min(5, Math.ceil(uv / 2))));
  setText('#visibility', current.weather_code >= 45 && current.weather_code <= 48 ? 'Reduced' : 'Clear');
}

function compass(degrees) { return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(degrees / 45) % 8]; }

function renderHourly(data) {
  const now = new Date(data.current.time).getTime();
  const start = data.hourly.time.findIndex((time) => new Date(time).getTime() >= now);
  const html = data.hourly.time.slice(Math.max(start, 0), Math.max(start, 0) + 24).map((time, index) => {
    const position = Math.max(start, 0) + index; const info = weatherInfo(data.hourly.weather_code[position]);
    return `<article class="hour-card"><span class="hour-time">${index === 0 ? 'Now' : timeLabel(time)}</span><span class="hour-icon">${info[1]}</span><strong class="hour-temp">${temp(data.hourly.temperature_2m[position])}</strong><span class="hour-rain">${rain(data.hourly.precipitation_probability[position])} rain</span></article>`;
  }).join('');
  $('#hourlyForecast').innerHTML = html || '<p class="loading">Hourly data unavailable.</p>';
}

function renderDaily(data) {
  $('#dailyForecast').innerHTML = data.daily.time.map((date, index) => {
    const info = weatherInfo(data.daily.weather_code[index]);
    return `<article class="daily-row"><div><strong class="daily-day">${index === 0 ? 'Today' : dayLabel(date)}</strong><span class="daily-date">${shortDate(date)}</span></div><span class="daily-icon">${info[1]}</span><span class="daily-condition">${info[0]}</span><span class="daily-temps">${temp(data.daily.temperature_2m_max[index])}<span>${temp(data.daily.temperature_2m_min[index])}</span></span><span class="daily-rain">${rain(data.daily.precipitation_probability_max[index])} rain</span></article>`;
  }).join('');
  setText('#forecastRange', `${shortDate(data.daily.time[0])} – ${shortDate(data.daily.time[6])}`);
}

async function loadLocation(location, { silent = false, record = !silent } = {}) {
  if (!silent) setText('#searchStatus', 'Loading conditions...');
  try {
    const data = await fetchWeather(location); state.location = location; state.weather = data;
    if (record) saveLocationSearch(location);
    $('#locationInput').value = location.name || '';
    renderCurrent(data); renderHourly(data); renderDaily(data); setText('#searchStatus', '');
  } catch (error) { if (!silent) setText('#searchStatus', error.message); }
}

$('#searchForm').addEventListener('submit', async (event) => {
  event.preventDefault(); const input = $('#locationInput');
  if (!input.value.trim()) return;
  hideSuggestions();
  setText('#searchStatus', 'Finding that place...');
  try { await loadLocation(await searchLocation(input.value.trim())); input.blur(); } catch (error) { setText('#searchStatus', error.message); }
});

$('#locationInput').addEventListener('input', () => {
  const query = $('#locationInput').value.trim(); const requestId = ++suggestionRequest;
  clearTimeout($('#locationInput').suggestionTimer);
  if (query.length < 2) { hideSuggestions(); return; }
  $('#locationInput').suggestionTimer = setTimeout(async () => {
    try {
      const results = await findLocations(query);
      if (requestId === suggestionRequest) showSuggestions(results);
    } catch { if (requestId === suggestionRequest) hideSuggestions(); }
  }, 150);
});

document.addEventListener('click', (event) => {
  if (!event.target.closest('.search-panel')) hideSuggestions();
});

$('#unitToggle').addEventListener('click', async () => {
  state.unit = fahrenheit() ? 'celsius' : 'fahrenheit';
  setText('#unitToggle', fahrenheit() ? '°F / °C' : '°C / °F');
  await loadLocation(state.location);
});

$('#locationButton').addEventListener('click', () => {
  if (!navigator.geolocation) { setText('#searchStatus', 'Location services are not supported by this browser.'); return; }
  setText('#searchStatus', 'Requesting your location...');
  navigator.geolocation.getCurrentPosition(async ({ coords }) => {
    try { await loadLocation(await searchLocation(`${coords.latitude}, ${coords.longitude}`)); }
    catch { await loadLocation({ ...state.location, latitude: coords.latitude, longitude: coords.longitude, name: 'Your location', admin1: '' }); }
  }, () => setText('#searchStatus', 'Location permission was not granted.'));
});

$('#regionSelect').addEventListener('change', async (event) => {
  const region = regionAliases[event.target.value];
  if (region) await loadLocation(region);
});

loadLocation(getMostSearchedLocation(), { record: false });

let refreshInFlight = false;
setInterval(async () => {
  if (refreshInFlight || !state.location) return;
  refreshInFlight = true;
  try { await loadLocation(state.location, { silent: true }); }
  finally { refreshInFlight = false; }
}, 10000);
