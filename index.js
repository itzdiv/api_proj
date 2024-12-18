import express from "express";
import axios from "axios";
import bodyParser from "body-parser";

const app = express();
const PORT = 3000;

// API Keys
//Get Your Own API KEY from opecageapi !
const OPEN_CAGE_API_KEY = "Your Own api key of opencage";

// Middleware
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");

// Home Route
app.get("/", (req, res) => {
  res.render("index", { data: null, error: null });
});

// Fetch City Information
app.post("/get-info", async (req, res) => {
  const { country, state, city } = req.body;
  let data = {
    city,
    state,
    country,
    aqi: "Fetching AQI...",
    weather: { temperature: "Fetching...", high: "Fetching...", low: "Fetching..." },
    timezone: "Fetching time zone...",
    sunriseSunset: "Fetching sunrise and sunset times...",
  };

  try {
    // Step 1: Get Coordinates from OpenCage API
    const geocodeUrl = `https://api.opencagedata.com/geocode/v1/json?q=${city},${state},${country}&key=${OPEN_CAGE_API_KEY}`;
    const geocodeResponse = await axios.get(geocodeUrl);

    if (geocodeResponse.data.results.length === 0) {
      throw new Error("Invalid location. Please check your input.");
    }

    const { lat, lng } = geocodeResponse.data.results[0].geometry;
    const timezone = geocodeResponse.data.results[0].annotations.timezone.name; // Fetch the timezone

    // Update the data object to include timezone
    data.timezone = timezone;

    // Step 2: Fetch Weather Data from Open-Meteo API
    try {
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&daily=temperature_2m_max,temperature_2m_min`;
      const weatherResponse = await axios.get(weatherUrl);

      if (weatherResponse.status === 200) {
        data.weather = {
          temperature: weatherResponse.data.current_weather.temperature,
          high: weatherResponse.data.daily.temperature_2m_max[0],
          low: weatherResponse.data.daily.temperature_2m_min[0],
        };
      } else {
        data.weather = { temperature: "N/A", high: "N/A", low: "N/A" };
      }
    } catch (error) {
      console.error("Error fetching weather data:", error.message);
      data.weather = { temperature: "N/A", high: "N/A", low: "N/A" };
    }

    // Step 3: Fetch AQI Data from Open-Meteo API
    try {
      const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&hourly=pm10,pm2_5`;
      const aqiResponse = await axios.get(aqiUrl);

      if (aqiResponse.status === 200) {
        const pm10 = aqiResponse.data.hourly.pm10[0]; // Fetch the latest PM10 value
        const pm2_5 = aqiResponse.data.hourly.pm2_5[0]; // Fetch the latest PM2.5 value

        // Define AQI descriptions
        const aqiDescription = (pmValue) => {
          if (pmValue <= 50) return "Good";
          if (pmValue <= 100) return "Moderate";
          if (pmValue <= 150) return "Unhealthy for Sensitive Groups";
          if (pmValue <= 200) return "Unhealthy";
          if (pmValue <= 300) return "Very Unhealthy";
          return "Hazardous";
        };

        data.aqi = `PM10: ${pm10} µg/m³ (${aqiDescription(pm10)}), PM2.5: ${pm2_5} µg/m³ (${aqiDescription(pm2_5)})`;
      } else {
        data.aqi = "Unable to fetch AQI data";
      }
    } catch (error) {
      console.error("Error fetching AQI data:", error.message);
      data.aqi = "Unable to fetch AQI data";
    }

    // Step 4: Fetch Sunrise and Sunset Times
    try {
      const sunData = geocodeResponse.data.results[0].annotations.sun;
      if (sunData) {
        const sunrise = new Date(sunData.rise.apparent * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
        const sunset = new Date(sunData.set.apparent * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

        data.sunriseSunset = `Sunrise: ${sunrise}, Sunset: ${sunset}`;
      } else {
        data.sunriseSunset = "Unavailable";
      }
    } catch (error) {
      console.error("Error fetching sunrise and sunset data:", error.message);
      data.sunriseSunset = "Unavailable";
    }
  } catch (error) {
    console.error("Error:", error.message);
    return res.render("index", { data: null, error: error.message });
  }

// Step 5: Fetch Famous Places Nearby using Wikipedia GeoSearch API
try {

    //refetching latitude and longitudes
    const geocodeUrl = `https://api.opencagedata.com/geocode/v1/json?q=${city},${state},${country}&key=${OPEN_CAGE_API_KEY}`;
    const geocodeResponse = await axios.get(geocodeUrl);

    if (geocodeResponse.data.results.length === 0) {
      throw new Error("Invalid location. Please check your input.");
    }

    const { lat, lng } = geocodeResponse.data.results[0].geometry;

    //wikipedia api
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gsradius=10000&gscoord=${lat}|${lng}&gslimit=10&format=json`;
    const wikiResponse = await axios.get(wikiUrl);

    if (wikiResponse.status === 200 && wikiResponse.data.query.geosearch.length > 0) {
        // Filter results to exclude schools or irrelevant locations
        const filteredPlaces = wikiResponse.data.query.geosearch.filter((place) => {
            // Exclude titles containing specific keywords
            const excludedKeywords = ["School", "University", "College", "Institute", "Academy"];
            const placeTitle = place.title.toLowerCase();

            // Only include places that do not match excluded keywords
            return !excludedKeywords.some(keyword => placeTitle.includes(keyword.toLowerCase()));
        });

        // Map the filtered results to the desired format
        data.places = filteredPlaces.map((place) => ({
            title: place.title,
            distance: place.dist,
            lat: place.lat,
            lng: place.lon,
        }));
    } else {
        data.places = []; // No places found
    }
} catch (error) {
    console.error("Error fetching famous places:", error.message);
    data.places = []; // Handle error by returning an empty list
}



  res.render("index", { data, error: null });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
