let cachedQuotes = [];

export async function getRandomQuote() {
  if (cachedQuotes.length === 0) {
    const res = await fetch("../inspirobot.json");
    cachedQuotes = await res.json();
  }

  const quote = cachedQuotes[Math.floor(Math.random() * cachedQuotes.length)];
  return quote;
}


