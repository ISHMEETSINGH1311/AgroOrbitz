/*******************************************************
 * AgroOrbitz - FINAL FULL SCRIPT.JS
 *******************************************************/

const API_BASE = "https://agroorbitz-api.onrender.com";
/* =========================================
   LOGIN SYSTEM
========================================= */

function checkLogin(){

  const loggedIn =
    localStorage.getItem(
      "agro_logged_in"
    );

  if(loggedIn !== "true"){

    window.location.href =
      "login.html";
  }
}

function logoutUser(){

  localStorage.removeItem(
    "agro_logged_in"
  );

  window.location.href =
    "login.html";
}


/* =========================================
   UTILITIES
========================================= */

function $(id){

  return document.getElementById(id);
}

function setText(id, value){

  const el = $(id);

  if(el){

    el.innerText = value;
  }
}

/* =========================================
   SAFE FETCH
========================================= */

async function fetchJSON(
  url,
  options = {}
){

  try{

    const res =
      await fetch(url, options);

    if(!res.ok){

      throw new Error(
        `HTTP ${res.status}`
      );
    }

    return await res.json();
  }

  catch(err){

    console.error(err);

    return null;
  }
}

/* =========================================
   AQI UI
========================================= */

function updateAQIUI(aqi){

  const badge =
    $("aqi-badge");

  const fill =
    $("aqi-fill");

  let label = "Moderate";
  let cls = "medium";
  let width = 50;

  aqi = Number(aqi);

  if(aqi <= 2){

    label = "Fair";

    cls = "low";

    width = 35;
  }

  else if(aqi === 3){

    label = "Moderate";

    cls = "medium";

    width = 60;
  }

  else{

    label = "Poor";

    cls = "high";

    width = 90;
  }

  badge.innerText = label;

  badge.className =
    `pill ${cls}`;

  fill.style.width =
    `${width}%`;
}

/* =========================================
   IRRIGATION ADVISOR
========================================= */

function updateIrrigationAdvice(
  temp,
  humidity,
  rain,
  moisture,
  nitrogen,
  organicMatter,
  compaction
){

  let status = "";
  let message = "";

  temp = parseFloat(temp);
  humidity = parseFloat(humidity);
  rain = parseFloat(rain);
  moisture = parseFloat(moisture);
  nitrogen = parseFloat(nitrogen);
  organicMatter = parseFloat(organicMatter);
  compaction = parseFloat(compaction);

  if(rain > 70){

    status = "Stop Irrigation";

    message =
      "Heavy rainfall expected.";
  }

  else if(moisture < 25){

    status =
      "Increase Irrigation";

    message =
      "Soil moisture is critically low.";
  }

  else if(nitrogen < 15){

    status =
      "Moderate Irrigation";

    message =
      "Low nitrogen detected.";
  }

  else if(compaction >= 4){

    status =
      "Reduce Irrigation";

    message =
      "High soil compaction detected.";
  }

  else if(organicMatter < 10){

    status =
      "Monitor Irrigation";

    message =
      "Low organic matter detected.";
  }

  else if(
    temp > 35 &&
    humidity < 40
  ){

    status =
      "Increase Irrigation";

    message =
      "Hot and dry conditions detected.";
  }

  else{

    status = "Optimal";

    message =
      "Current irrigation level is healthy.";
  }

  setText(
    "irrigation-status",
    status
  );

  setText(
    "irrigation-message",
    message
  );
}

/* =========================================
   WEATHER
========================================= */

async function loadWeather(){

  const city =
    $("city-input")
      ?.value
      ?.trim() || "Delhi";

  const data =
    await fetchJSON(
      `${API_BASE}/api/weather?city=${encodeURIComponent(city)}`
    );

  if(!data) return;

  setText(
    "weather-temp",
    `${data.temp} °C`
  );

  setText(
    "weather-humidity",
    `${data.humidity} %`
  );

  setText(
    "weather-wind",
    `${data.wind} km/h`
  );

  setText(
    "weather-rain",
    `${data.rainProb} %`
  );

  setText(
    "aqi-level",
    data.aqi
  );

  updateAQIUI(data.aqi);
}

/* =========================================
   CROP RECOMMENDATION
========================================= */

async function loadCropRecommendation(){

  const previousCrop =
    $("previous-crop")?.value;

  const data =
    await fetchJSON(
      `${API_BASE}/api/crop/recommend`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          previousCrop
        })
      }
    );

  if(!data) return;

  setText(
    "recommended-crop",
    data.recommendedNext
  );
}

/* =========================================
   SOIL ANALYSIS
========================================= */

async function analyzeSoil(){

  const moisture =
    parseFloat(
      $("in-moisture")?.value
    );

  const nitrogen =
    parseFloat(
      $("in-nitrogen")?.value
    );

  const organicMatter =
    parseFloat(
      $("in-om")?.value
    );

  const compaction =
    parseFloat(
      $("in-compaction")?.value
    );

  const features = [
    moisture,
    nitrogen,
    organicMatter,
    compaction
  ];

  const data =
    await fetchJSON(
      `${API_BASE}/api/soil/analyze`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          features
        })
      }
    );

  let soilStatus =
    "Healthy Soil";

  let soilMessage =
    "Soil conditions are optimal for farming.";

  if(moisture < 25){

    soilStatus =
      "Low Moisture";

    soilMessage =
      "Increase irrigation immediately.";
  }

  else if(nitrogen < 15){

    soilStatus =
      "Nitrogen Deficiency";

    soilMessage =
      "Add nitrogen fertilizer to improve soil health.";
  }

  else if(compaction >= 4){

    soilStatus =
      "High Compaction";

    soilMessage =
      "Soil is compacted. Aeration recommended.";
  }

  else if(organicMatter < 10){

    soilStatus =
      "Low Organic Matter";

    soilMessage =
      "Add compost or organic nutrients.";
  }

  setText(
    "soil-status",
    soilStatus
  );

  setText(
    "soil-message",
    soilMessage
  );

  updateIrrigationAdvice(
    parseFloat(
      $("weather-temp")
        ?.innerText
    ),

    parseFloat(
      $("weather-humidity")
        ?.innerText
    ),

    parseFloat(
      $("weather-rain")
        ?.innerText
    ),

    moisture,
    nitrogen,
    organicMatter,
    compaction
  );

  alert(
    "Soil analysis completed"
  );
}

/* =========================================
   NDVI SATELLITE MONITOR
========================================= */

function analyzeNDVI(){

  const condition =
    $("ndvi-condition")
      ?.value;

  let score = "";
  let message = "";

  if(condition === "healthy"){

    score = "0.82";

    message =
      "Excellent crop health detected from satellite vegetation index.";
  }

  else if(
    condition === "moderate"
  ){

    score = "0.54";

    message =
      "Moderate vegetation health detected.";
  }

  else{

    score = "0.21";

    message =
      "Poor vegetation health detected.";
  }

  setText(
    "ndvi-score",
    score
  );

  setText(
    "ndvi-message",
    message
  );
}

/* =========================================
   INIT
========================================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {

   $("btn-city-search")
  ?.addEventListener(
    "click",
    async () => {

      await loadWeather();

      updateFarmMap();
    }
  );

    $("btn-soil-analyze")
      ?.addEventListener(
        "click",
        analyzeSoil
      );

    $("btn-ndvi")
      ?.addEventListener(
        "click",
        analyzeNDVI
      );
      
      $("btn-yield")
        ?.addEventListener(
          "click",
          predictYield
      );
      $("btn-disaster")
  ?.addEventListener(
    "click",
    checkDisasterRisk
  );
  $("btn-market")
  ?.addEventListener(
    "click",
    predictMarketPrice
  );

   $("previous-crop")
  ?.addEventListener(
    "change",
    () => {

      loadCropRecommendation();

      updateCropWeatherAdvisor();
    }
  );

 await loadWeather();

await loadCropRecommendation();

initFarmMap();

updateFarmMap();
  }
);

/* =========================================
   CHATBOT
========================================= */

const chatbotToggle =
  $("chatbot-toggle");

const chatbotWindow =
  $("chatbot-window");

const chatbotClose =
  $("chatbot-close");

const chatbotSend =
  $("chatbot-send");

const chatbotInput =
  $("chatbot-input");

const chatbotMessages =
  $("chatbot-messages");

chatbotToggle?.addEventListener(
  "click",
  () => {

    if(
      chatbotWindow.style.display
      === "flex"
    ){

      chatbotWindow.style.display =
        "none";
    }

    else{

      chatbotWindow.style.display =
        "flex";
    }
  }
);

chatbotClose?.addEventListener(
  "click",
  () => {

    chatbotWindow.style.display =
      "none";
  }
);

chatbotSend?.addEventListener(
  "click",
  sendChatMessage
);

chatbotInput?.addEventListener(
  "keypress",
  (e) => {

    if(e.key === "Enter"){

      sendChatMessage();
    }
  }
);

async function sendChatMessage(){

  const message =
    chatbotInput.value.trim();

  if(!message) return;

  const userDiv =
    document.createElement("div");

  userDiv.className =
    "user-message";

  userDiv.innerText =
    message;

  chatbotMessages.appendChild(
    userDiv
  );

  chatbotInput.value = "";

  const botDiv =
    document.createElement("div");

  botDiv.className =
    "bot-message";

  botDiv.innerText =
    "Thinking...";

  chatbotMessages.appendChild(
    botDiv
  );

  try{

    const res =
      await fetch(
        `${API_BASE}/api/chat`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            message
          })
        }
      );

    const data =
      await res.json();

    botDiv.innerText =
      data.reply ||
      "No response.";
  }

  catch(err){

    console.error(err);

    botDiv.innerText =
      "AI unavailable.";
  }
}

/* =========================================
   PDF REPORT
========================================= */

document
  .getElementById(
    "download-report-btn"
  )
  ?.addEventListener(
    "click",
    downloadFarmReport
  );

async function downloadFarmReport(){

  try{

    const payload = {

      city:
        $("city-input")?.value
        || "Unknown",

      weather: {

        temp:
          $("weather-temp")
            ?.innerText || "--",

        humidity:
          $("weather-humidity")
            ?.innerText || "--",

        wind:
          $("weather-wind")
            ?.innerText || "--",

        rainProb:
          $("weather-rain")
            ?.innerText || "--",

        aqi:
          $("aqi-level")
            ?.innerText || "--"
      },

      soil: {

        moisture:
          $("in-moisture")
            ?.value || "--",

        nitrogen:
          $("in-nitrogen")
            ?.value || "--",

        organicMatter:
          $("in-om")
            ?.value || "--",

        compactionRisk:
          $("in-compaction")
            ?.value || "--"
      },

      irrigation: {

        status:
          $("irrigation-status")
            ?.innerText || "--"
      },

      crop: {

        recommendedNext:
          $("recommended-crop")
            ?.innerText || "--"
      }
    };

    const response =
      await fetch(
        `${API_BASE}/api/report`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify(
            payload
          )
        }
      );

    const blob =
      await response.blob();

    const url =
      window.URL
        .createObjectURL(blob);

    const a =
      document.createElement("a");

    a.href = url;

    a.download =
      "AgroOrbitz_Report.pdf";

    document.body.appendChild(a);

    a.click();

    a.remove();
  }

  catch(err){

    console.error(err);

    alert(
      "Failed to generate report."
    );
  }
}

/* =========================================
   VOICE ASSISTANT
========================================= */

const voiceBtn =
  $("voice-btn");

const SpeechRecognition =
  window.SpeechRecognition
  ||
  window.webkitSpeechRecognition;

if(SpeechRecognition){

  const recognition =
    new SpeechRecognition();

  recognition.lang =
    "en-US";

  recognition.continuous =
    false;

  recognition.interimResults =
    false;

  voiceBtn?.addEventListener(
    "click",
    () => {

      recognition.start();

      voiceBtn.innerText =
        "🎙️ Listening...";
    }
  );

  recognition.onresult =
    function(event){

      const transcript =
        event.results[0][0]
          .transcript
          .toLowerCase()
          .trim();

      voiceBtn.innerText =
        "🎤 Voice";

      if(
        transcript.includes(
          "weather"
        )
      ){

        const city =
          transcript.replace(
            "weather",
            ""
          ).trim();

        $("city-input").value =
          city;

        $("btn-city-search")
          .click();

        return;
      }

      if(
        transcript.includes(
          "analyze soil"
        )
      ){

        $("btn-soil-analyze")
          .click();

        return;
      }

      if(
        transcript.includes(
          "download report"
        )
      ){

        $("download-report-btn")
          .click();

        return;
      }

      chatbotWindow.style.display =
        "flex";

      chatbotInput.value =
        transcript;

      chatbotSend.click();
    };

  recognition.onerror =
    function(){

      voiceBtn.innerText =
        "🎤 Voice";
    };

  recognition.onend =
    function(){

      voiceBtn.innerText =
        "🎤 Voice";
    };
}
/* =========================================
   SMART CROP WEATHER ADVISOR
========================================= */

function updateCropWeatherAdvisor(){

  const crop =
    $("previous-crop")?.value;

  const temp =
    parseFloat(
      $("weather-temp")
        ?.innerText
    );

  const rain =
    parseFloat(
      $("weather-rain")
        ?.innerText
    );

  let status = "";
  let message = "";

  /* RICE */

  if(crop === "rice"){

    if(temp > 38){

      status =
        "Poor Weather";

      message =
        "Temperature is too high for healthy rice growth.";
    }

    else if(rain < 30){

      status =
        "Needs Irrigation";

      message =
        "Rice requires more water in current conditions.";
    }

    else{

      status =
        "Excellent";

      message =
        "Current weather is suitable for rice cultivation.";
    }
  }

  /* WHEAT */

  else if(crop === "wheat"){

    if(temp > 32){

      status =
        "Heat Risk";

      message =
        "High temperature may reduce wheat yield.";
    }

    else{

      status =
        "Good";

      message =
        "Weather conditions are favorable for wheat.";
    }
  }

  /* MAIZE */

  else if(crop === "maize"){

    if(rain > 80){

      status =
        "Flood Risk";

      message =
        "Excess rainfall may damage maize roots.";
    }

    else{

      status =
        "Healthy";

      message =
        "Weather supports maize growth.";
    }
  }

  else{

    status =
      "Stable";

    message =
      "Current crop conditions are acceptable.";
  }

  setText(
    "crop-weather-status",
    status
  );

  setText(
    "crop-weather-message",
    message
  );
}
/* =========================================
   AI PLANT DISEASE DETECTOR
========================================= */


/* =========================================
   AI YIELD PREDICTOR
========================================= */

function predictYield(){

  const crop =
    $("yield-crop")
      ?.value;

  const temp =
    parseFloat(
      $("weather-temp")
        ?.innerText
    );

  const rain =
    parseFloat(
      $("weather-rain")
        ?.innerText
    );

  const moisture =
    parseFloat(
      $("in-moisture")
        ?.value
    );

  let yieldResult = "";
  let message = "";

  /* RICE */

  if(crop === "rice"){

    if(
      rain > 50 &&
      moisture > 40
    ){

      yieldResult =
        "High Yield";

      message =
        "Excellent water availability for rice production.";
    }

    else{

      yieldResult =
        "Medium Yield";

      message =
        "Rice may require more irrigation support.";
    }
  }

  /* WHEAT */

  else if(crop === "wheat"){

    if(temp < 30){

      yieldResult =
        "High Yield";

      message =
        "Weather is favorable for wheat growth.";
    }

    else{

      yieldResult =
        "Low Yield";

      message =
        "High temperature may reduce wheat productivity.";
    }
  }

  /* MAIZE */

  else{

    if(
      moisture > 35 &&
      rain < 80
    ){

      yieldResult =
        "Good Yield";

      message =
        "Current conditions support maize production.";
    }

    else{

      yieldResult =
        "Moderate Yield";

      message =
        "Monitor rainfall and soil moisture carefully.";
    }
  }

  setText(
    "yield-status",
    yieldResult
  );

  setText(
    "yield-message",
    message
  );
}
/* =========================================
   AI DISASTER ALERT SYSTEM
========================================= */

function checkDisasterRisk(){

  const temp =
    parseFloat(
      $("weather-temp")
        ?.innerText
    );

  const rain =
    parseFloat(
      $("weather-rain")
        ?.innerText
    );

  const wind =
    parseFloat(
      $("weather-wind")
        ?.innerText
    );

  let status = "";
  let message = "";

  /* HEATWAVE */

  if(temp > 42){

    status =
      "Heatwave Alert";

    message =
      "Extreme temperature detected. Increase irrigation and avoid daytime spraying.";
  }

  /* FLOOD */

  else if(rain > 85){

    status =
      "Flood Risk";

    message =
      "Heavy rainfall may cause waterlogging in fields.";
  }

  /* STORM */

  else if(wind > 45){

    status =
      "Storm Warning";

    message =
      "High wind speed detected. Protect crops and infrastructure.";
  }

  /* DROUGHT */

  else if(
    temp > 35 &&
    rain < 20
  ){

    status =
      "Drought Risk";

    message =
      "Low rainfall and high heat may affect crop productivity.";
  }

  else{

    status =
      "Safe Conditions";

    message =
      "No major disaster risks detected currently.";
  }

  setText(
    "disaster-status",
    status
  );

  setText(
    "disaster-message",
    message
  );
}
/* =========================================
   AI MARKET PRICE PREDICTOR
========================================= */

function predictMarketPrice(){

  const crop =
    $("market-crop")
      ?.value;

  let status = "";
  let message = "";

  /* RICE */

  if(crop === "rice"){

    status =
      "₹2200 / quintal";

    message =
      "Rice demand is increasing. Good selling opportunity expected.";
  }

  /* WHEAT */

  else if(crop === "wheat"){

    status =
      "₹2450 / quintal";

    message =
      "Stable wheat market with moderate profit potential.";
  }

  /* MAIZE */

  else if(crop === "maize"){

    status =
      "₹1900 / quintal";

    message =
      "Maize prices may fluctuate due to seasonal demand.";
  }

  /* SOYBEAN */

  else{

    status =
      "₹4300 / quintal";

    message =
      "Soybean market trend is strong with high export demand.";
  }

  setText(
    "market-status",
    status
  );

  setText(
    "market-message",
    message
  );
}
/* =========================================
   SMART FARM MAP
========================================= */

let farmMap;
let farmMarker;

function initFarmMap(){

  farmMap = L.map(
    "farm-map"
  ).setView(
    [28.6139, 77.2090],
    5
  );

  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution:
        "&copy; OpenStreetMap contributors"
    }
  ).addTo(farmMap);

  farmMarker = L.marker(
    [28.6139, 77.2090]
  ).addTo(farmMap);

  farmMarker.bindPopup(
    "AgroOrbitz Farm Location"
  ).openPopup();
}

function updateFarmMap(){

  const city =
    $("city-input")
      ?.value
      ?.toLowerCase();

  let coords = [28.6139, 77.2090];

  if(city.includes("mumbai")){

    coords = [19.0760, 72.8777];
  }

  else if(city.includes("chennai")){

    coords = [13.0827, 80.2707];
  }

  else if(city.includes("bangalore")){

    coords = [12.9716, 77.5946];
  }

  else if(city.includes("kolkata")){

    coords = [22.5726, 88.3639];
  }

  else if(city.includes("hyderabad")){

    coords = [17.3850, 78.4867];
  }

  else{

    coords = [28.6139, 77.2090];
  }

  farmMap.setView(
    coords,
    8
  );

  farmMarker.setLatLng(
    coords
  );

  farmMarker.bindPopup(
    `Farm Location: ${city}`
  );
}



/* =========================================
   MULTI LANGUAGE
========================================= */

/* =========================================
   MULTI LANGUAGE
========================================= */

const languageSelect =
  $("language-select");

const translations = {

  en: {

    dashboard: "Dashboard",
    about: "About",
    features: "Features",

    weather: "Weather & AQI",

    crop: "Crop Rotator",

    soil: "Soil Condition Analyzer",

    irrigation: "Irrigation Advisor",

    report: "Farm Report",

    ndvi: "Satellite NDVI Monitor"
  },

  hi: {

    dashboard: "डैशबोर्ड",
    about: "जानकारी",
    features: "विशेषताएँ",

    weather: "मौसम और AQI",

    crop: "फसल रोटेटर",

    soil: "मिट्टी विश्लेषण",

    irrigation: "सिंचाई सलाह",

    report: "फार्म रिपोर्ट",

    ndvi: "सैटेलाइट NDVI मॉनिटर"
  },

  pa: {

    dashboard: "ਡੈਸ਼ਬੋਰਡ",
    about: "ਜਾਣਕਾਰੀ",
    features: "ਫੀਚਰ",

    weather: "ਮੌਸਮ ਅਤੇ AQI",

    crop: "ਫਸਲ ਰੋਟੇਟਰ",

    soil: "ਮਿੱਟੀ ਵਿਸ਼ਲੇਸ਼ਣ",

    irrigation: "ਸਿੰਚਾਈ ਸਲਾਹ",

    report: "ਫਾਰਮ ਰਿਪੋਰਟ",

    ndvi: "ਸੈਟੇਲਾਈਟ NDVI ਮਾਨੀਟਰ"
  },

  ta: {

    dashboard: "டாஷ்போர்டு",
    about: "தகவல்",
    features: "அம்சங்கள்",

    weather: "வானிலை மற்றும் AQI",

    crop: "பயிர் சுழற்சி",

    soil: "மண் பகுப்பாய்வு",

    irrigation: "நீர்ப்பாசன ஆலோசனை",

    report: "பண்ணை அறிக்கை",

    ndvi: "சாட்டிலைட் NDVI"
  },

  te: {

    dashboard: "డాష్‌బోర్డ్",
    about: "గురించి",
    features: "ఫీచర్లు",

    weather: "వాతావరణం మరియు AQI",

    crop: "పంట రొటేటర్",

    soil: "మట్టి విశ్లేషణ",

    irrigation: "పారుదల సలహా",

    report: "వ్యవసాయ నివేదిక",

    ndvi: "శాటిలైట్ NDVI"
  },

  mr: {

    dashboard: "डॅशबोर्ड",
    about: "माहिती",
    features: "वैशिष्ट्ये",

    weather: "हवामान आणि AQI",

    crop: "पीक रोटेटर",

    soil: "माती विश्लेषण",

    irrigation: "सिंचन सल्ला",

    report: "शेती अहवाल",

    ndvi: "उपग्रह NDVI"
  },

  cg: {

    dashboard: "डैशबोर्ड",
    about: "जानकारी",
    features: "फीचर",

    weather: "मौसम अउ AQI",

    crop: "फसल रोटेटर",

    soil: "मिट्टी जांच",

    irrigation: "सिंचाई सलाह",

    report: "खेती रिपोर्ट",

    ndvi: "सैटेलाइट NDVI"
  },

  fr: {

    dashboard:
      "Tableau de bord",

    about: "À propos",

    features:
      "Fonctionnalités",

    weather:
      "Météo et AQI",

    crop:
      "Rotation des cultures",

    soil:
      "Analyse du sol",

    irrigation:
      "Conseil d'irrigation",

    report:
      "Rapport agricole",

    ndvi:
      "Moniteur NDVI Satellite"
  },

  de: {

    dashboard: "Dashboard",

    about: "Über",

    features: "Funktionen",

    weather:
      "Wetter und AQI",

    crop:
      "Fruchtrotation",

    soil:
      "Bodenanalyse",

    irrigation:
      "Bewässerungsberatung",

    report:
      "Farmbericht",

    ndvi:
      "Satelliten NDVI"
  },

  ja: {

    dashboard:
      "ダッシュボード",

    about: "概要",

    features: "機能",

    weather:
      "天気とAQI",

    crop:
      "作物ローテーション",

    soil:
      "土壌分析",

    irrigation:
      "灌漑アドバイス",

    report:
      "農場レポート",

    ndvi:
      "衛星NDVI"
  }
};

languageSelect?.addEventListener(
  "change",
  () => {

    const lang =
      languageSelect.value;

    const t =
      translations[lang];

    /* NAVBAR */

    document.querySelectorAll(
      ".nav-center a"
    )[0].innerText =
      t.dashboard;

    document.querySelectorAll(
      ".nav-center a"
    )[1].innerText =
      t.about;

    document.querySelectorAll(
      ".nav-center a"
    )[2].innerText =
      t.features;

    /* CARD HEADINGS */

    document.querySelectorAll(
      ".card h2"
    )[0].innerText =
      t.weather;

    document.querySelectorAll(
      ".card h2"
    )[1].innerText =
      t.crop;

    document.querySelectorAll(
      ".card h2"
    )[2].innerText =
      t.soil;

    document.querySelectorAll(
      ".card h2"
    )[3].innerText =
      t.irrigation;

    document.querySelectorAll(
      ".card h2"
    )[4].innerText =
      t.report;

    document.querySelectorAll(
      ".card h2"
    )[5].innerText =
      t.ndvi;
  }
);
const imageInput = document.getElementById("imageInput");

const previewImage = document.getElementById("previewImage");

imageInput.addEventListener("change", () => {

  const file = imageInput.files[0];

  if (file) {

    previewImage.src = URL.createObjectURL(file);

    previewImage.style.display = "block";
  }
});

async function predictDisease() {

  const file = imageInput.files[0];

  if (!file) {

    alert("Please upload an image first");

    return;
  }

  const formData = new FormData();

  formData.append("file", file);

  document.getElementById("disease-status").innerHTML =
    "🌿 Analyzing Leaf...";

  document.getElementById("disease-message").innerHTML =
    "AI model is processing the uploaded plant image.";

  try {

    const response = await fetch(
      "https://agroorbitz-api.onrender.com/predict",
      {
        method: "POST",
        body: formData
      }
    );

    const data = await response.json();

    document.getElementById("disease-status").innerHTML =
      `🌱 ${data.disease}`;

    document.getElementById("disease-message").innerHTML =
      `
      <strong>Confidence:</strong> ${data.confidence}% <br><br>

      <strong>🦠 Cause:</strong><br>
      ${data.cause} <br><br>

      <strong>💊 Treatment:</strong><br>
      ${data.treatment} <br><br>

      <strong>🛡️ Prevention:</strong><br>
      ${data.prevention}
      `;

  } catch (error) {

    console.error(error);

    document.getElementById("disease-status").innerHTML =
      "Prediction Failed";

    document.getElementById("disease-message").innerHTML =
      "Backend connection error.";
  }
}