// Uses Open-Meteo API, which requires no API Key for free usage.

// Helper to get coordinates for a location string using Open-Meteo Geocoding
export const getCoordinates = async (location) => {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch geocoding data');
    const data = await response.json();
    if (!data.results || data.results.length === 0) throw new Error('Location not found');
    return {
      lat: data.results[0].latitude,
      lon: data.results[0].longitude,
      name: data.results[0].name,
      country: data.results[0].country
    };
  } catch (error) {
    console.error('Error fetching coordinates:', error);
    throw error;
  }
};

// Fetch weather data (temperature, humidity, precipitation)
export const getWeatherData = async (lat, lon) => {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,rain,showers&hourly=temperature_2m,relative_humidity_2m,precipitation&timezone=auto`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch weather data');
    const data = await response.json();
    return {
      temperature: data.current.temperature_2m,
      humidity: data.current.relative_humidity_2m,
      precipitation: data.current.precipitation || 0,
      timestamp: data.current.time
    };
  } catch (error) {
    console.error('Error fetching weather:', error);
    throw error;
  }
};

// AQI label and color based on European AQI scale
export const getAQILabel = (aqi) => {
  if (aqi == null) return { label: 'Unknown', color: '#6b7280', bg: 'rgba(107,114,128,0.15)' };
  if (aqi <= 20) return { label: 'Good', color: '#10b981', bg: 'rgba(16,185,129,0.15)' };
  if (aqi <= 40) return { label: 'Fair', color: '#84cc16', bg: 'rgba(132,204,22,0.15)' };
  if (aqi <= 60) return { label: 'Moderate', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' };
  if (aqi <= 80) return { label: 'Poor', color: '#f97316', bg: 'rgba(249,115,22,0.15)' };
  if (aqi <= 100) return { label: 'Very Poor', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' };
  return { label: 'Hazardous', color: '#7c3aed', bg: 'rgba(124,58,237,0.15)' };
};

// Fetch Air Quality Index data from Open-Meteo Air Quality API
export const getAQIData = async (lat, lon) => {
  try {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,ozone`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch AQI data');
    const data = await response.json();
    const aqi = data.current?.european_aqi ?? null;
    const aqiInfo = getAQILabel(aqi);
    return {
      european_aqi: aqi,
      pm2_5: data.current?.pm2_5 ?? null,
      pm10: data.current?.pm10 ?? null,
      nitrogen_dioxide: data.current?.nitrogen_dioxide ?? null,
      ozone: data.current?.ozone ?? null,
      label: aqiInfo.label,
      color: aqiInfo.color,
      bg: aqiInfo.bg,
    };
  } catch (error) {
    console.error('Error fetching AQI:', error);
    // Return a graceful fallback so dashboards don't crash
    return {
      european_aqi: null,
      pm2_5: null,
      pm10: null,
      label: 'Unavailable',
      color: '#6b7280',
      bg: 'rgba(107,114,128,0.15)',
    };
  }
};

// Fetch both weather + AQI together for a city name
export const getEnvironmentalData = async (city) => {
  const coords = await getCoordinates(city);
  const [weather, aqi] = await Promise.all([
    getWeatherData(coords.lat, coords.lon),
    getAQIData(coords.lat, coords.lon),
  ]);
  return { coords, weather, aqi };
};
