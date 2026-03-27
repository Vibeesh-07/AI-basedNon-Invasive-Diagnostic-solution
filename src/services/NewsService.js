// This service simulates fetching News Data. 
// A real Implementation could use GNews API, NewsAPI, or a custom NLP backend.

const mockHeadlines = [
  "Local hospitals report an uptick in mysterious flu cases.",
  "Health officials warn of stagnant water after recent heavy rains.",
  "City council budgets for more mosquito spraying this summer.",
  "Heatwave continues, residents urged to stay hydrated.",
  "Clean water initiative launched in rural districts."
];

// Helper to randomly pick news for the simulation
const getRandomNews = (count = 3) => {
  const shuffled = [...mockHeadlines].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

export const fetchLocalNews = async (location) => {
  // Simulate network delay
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        location: location,
        articles: getRandomNews(3).map(title => ({
          title,
          source: 'Local Mock News',
          publishedAt: new Date().toISOString()
        }))
      });
    }, 800);
  });
};
