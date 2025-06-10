const baseURL = "https://raw.githubusercontent.com/sxoxgxi/walls/master/";

fetch(baseURL + "metadata.json")
  .then((res) => res.json())
  .then((data) => {
    const container = document.querySelector("main");

    Object.values(data).forEach(({ name, description, file_path }) => {
      const fileName = file_path.split("/").pop();

      const card = document.createElement("div");
      card.className = "wallpaper-card";
      card.innerHTML = `
              <img src="${baseURL + "sources/" + fileName}" alt="${name}" loading="lazy" />
              <div class="overlay">
                <p>${description}</p>
                <a href="${baseURL + "sources/" + fileName}" download>Download</a>
              </div>
            `;
      container.appendChild(card);
    });
  });

const apiURL =
  "https://api.github.com/repos/sxoxgxi/walls/commits?path=metadata.json&per_page=1";

function timeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);

  const intervals = [
    { label: "year", seconds: 31536000 },
    { label: "month", seconds: 2592000 },
    { label: "week", seconds: 604800 },
    { label: "day", seconds: 86400 },
    { label: "hour", seconds: 3600 },
    { label: "minute", seconds: 60 },
  ];

  for (const interval of intervals) {
    const count = Math.floor(seconds / interval.seconds);
    if (count >= 1) {
      return `${count} ${interval.label}${count > 1 ? "s" : ""} ago`;
    }
  }
  return "just now";
}

fetch(apiURL)
  .then((res) => res.json())
  .then((data) => {
    if (data.length > 0) {
      const dateStr = data[0].commit.committer.date;
      const date = new Date(dateStr);
      const ago = timeAgo(date);

      document.getElementById("last-updated").textContent =
        `Last updated: ${ago}`;
    }
  })
  .catch(console.error);
