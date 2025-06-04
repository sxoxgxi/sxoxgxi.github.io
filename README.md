## Preview

[![Preview](./media/site_ss.png)](https://sxoxgxi.github.io/)

## **To-Do: Discord Independent Presence**

### Part 1: Setup Backend

- [ ] Create a server with `POST /activity` endpoint
- [ ] Store last known activity in a JSON file or database
- [ ] Add `GET /activity` route for fetching current presence

---

### Part 2: Local Scripts for Updates

- [ ] Create a Node.js or shell script to:
  - [ ] Detect current song from Spotify
  - [ ] Detect active app/window
- [ ] POST activity data to backend every X seconds

---

### Part 3: Update Website

- [ ] Integrate custom `/activity` API with existing setup
- [ ] Use fallback for activity data when Discord is inactive
- [ ] Display "Offline" or "Last seen" when no data is available
