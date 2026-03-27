// Uses Open-Meteo API, which requires no API Key for free usage.

// Helper to get coordinates for a location string using Open-Meteo Geocoding
export const getCoordinates = async (location) => {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch geocoding data');
    const data = await response.json();
    
    if (!data.results || data.results.length === 0) {
      throw new Error('Location not found');
    }
    
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

// Main function to fetch weather data for prediction
export const getWeatherData = async (lat, lon) => {
  try {
    // We request temperature, humidity, and precipitation for currently, and recent past potentially for accurate risk
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
