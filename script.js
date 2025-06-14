const options = {
  key: 'aJiwvHej7ZowjaHKgYALAur635Bf2l1I',
  verbose: true,
  lat: 50.4, lon: 14.3, zoom: 5,
};

const renewableFacts = [
    "Did you know? The energy from the sun that hits the earth in one hour could power the world for a year.",
    "Wind turbines can produce electricity even at low wind speeds.",
    "Wave energy is one of the most consistent forms of renewable energy.",
    "Solar panels work best in direct sunlight, but they can still generate power on cloudy days.",
    "Offshore wind farms can generate more power due to stronger and more consistent winds.",
    "Renewable energy helps reduce greenhouse gas emissions and combat climate change.",
    "Combining wind, solar, and wave energy can provide a more stable energy supply.",
    "The cost of solar and wind energy has dropped dramatically in the last decade.",
    "Wave energy is especially promising for coastal regions.",
    "Storing renewable energy in batteries helps balance supply and demand."
];

// Helper to get a random fact
function getRandomFact() {
    return renewableFacts[Math.floor(Math.random() * renewableFacts.length)];
}

async function fetchEnergyData(lat, lon) {
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=wind_speed_10m,shortwave_radiation&timezone=auto`;
  const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&hourly=wave_height,wave_period&timezone=auto`;

  try {
    const [weatherRes, marineRes] = await Promise.all([
      fetch(weatherUrl),
      fetch(marineUrl)
    ]);

    const weatherData = await weatherRes.json();
    const marineData = await marineRes.json();

    const now = new Date();
    const currentHour = now.getHours();

    const timestamp = weatherData.hourly.time?.[currentHour] ?? 'Unknown time';
    const wind = weatherData.hourly.wind_speed_10m?.[currentHour];
    const solar = weatherData.hourly.shortwave_radiation?.[currentHour];
    const waveHeight = marineData.hourly.wave_height?.[currentHour];
    const wavePeriod = marineData.hourly.wave_period?.[currentHour];

    // Calculate wave power
    let wavePower = 'No data';
    if (waveHeight != null && wavePeriod != null) {
      const g = 9.81;
      const rho = 1025;
      wavePower = (rho * Math.pow(g, 2) / (64 * Math.PI)) * Math.pow(waveHeight, 2) * wavePeriod;
      wavePower = wavePower.toFixed(2);
    }

    // Calculate wind power
    let windPower = 'No data';
    if (wind != null) {
      const rhoAir = 1.225;
      const area = 1; // m²
      windPower = 0.5 * rhoAir * area * Math.pow(wind, 3);
      windPower = windPower.toFixed(2);
    }

    // Estimate solar energy potential (kWh/m²/day)
    let solarEnergy = 'No data';
    if (solar != null) {
      solarEnergy = ((solar * 5) / 1000).toFixed(2); // 5 peak sun hours
    }

    return {
      timestamp,
      wind: wind ?? 'No data',
      windPower,
      solar: solar ?? 'No data',
      solarEnergy,
      waveHeight: waveHeight ?? 'No data',
      wavePeriod: wavePeriod ?? 'No data',
      wavePower
    };

  } catch (error) {
    console.error("Error fetching energy data:", error);
    return null;
  }
}

let mixChart; // Chart.js instance

function updateMixChart(windPct, solarPct, wavePct) {
    const ctx = document.getElementById('mixChart').getContext('2d');
    const data = {
        labels: ['Wind', 'Solar', 'Wave'],
        datasets: [{
            data: [windPct, solarPct, wavePct],
            backgroundColor: ['#4a90e2', '#f9d423', '#50e3c2'],
            borderWidth: 1
        }]
    };
    if (mixChart) {
        mixChart.data.datasets[0].data = [windPct, solarPct, wavePct];
        mixChart.update();
    } else {
        mixChart = new Chart(ctx, {
            type: 'pie',
            data: data,
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'bottom' },
                    title: { display: true, text: 'Renewable Energy Mix (%)' }
                }
            }
        });
    }
}

let trendChart; // Chart.js instance for trend

async function updateTrendChart(lat, lon) {
    // Fetch data as before...
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=wind_speed_10m,shortwave_radiation&timezone=auto`;
    const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&hourly=wave_height,wave_period&timezone=auto`;

    const [weatherRes, marineRes] = await Promise.all([
        fetch(weatherUrl),
        fetch(marineUrl)
    ]);
    const weatherData = await weatherRes.json();
    const marineData = await marineRes.json();

    // Get the current hour index
    const now = new Date();
    const currentHour = now.getHours();

    // Next 24 hours from now
    const hours = weatherData.hourly.time.slice(currentHour, currentHour + 24).map(t => t.slice(11, 16));
    let windArr = [], solarArr = [], waveArr = [];

    for (let i = currentHour; i < currentHour + 24; i++) {
        // Wind
        let wind = weatherData.hourly.wind_speed_10m?.[i];
        let windPower = wind != null ? 0.5 * 1.225 * 1 * Math.pow(wind, 3) : 0;

        // Solar
        let solar = weatherData.hourly.shortwave_radiation?.[i] || 0;

        // Wave
        let waveHeight = marineData.hourly.wave_height?.[i];
        let wavePeriod = marineData.hourly.wave_period?.[i];
        let wavePower = (waveHeight != null && wavePeriod != null)
            ? (1025 * Math.pow(9.81, 2) / (64 * Math.PI)) * Math.pow(waveHeight, 2) * wavePeriod
            : 0;

        let total = windPower + solar + wavePower;
        windArr.push(total > 0 ? (windPower / total) * 100 : 0);
        solarArr.push(total > 0 ? (solar / total) * 100 : 0);
        waveArr.push(total > 0 ? (wavePower / total) * 100 : 0);
    }

    const ctx = document.getElementById('trendChart').getContext('2d');
    const data = {
        labels: hours,
        datasets: [
            {
                label: 'Wind (%)',
                data: windArr,
                borderColor: '#4a90e2',
                backgroundColor: 'rgba(74,144,226,0.1)',
                fill: false,
                tension: 0.2
            },
            {
                label: 'Solar (%)',
                data: solarArr,
                borderColor: '#f9d423',
                backgroundColor: 'rgba(249,212,35,0.1)',
                fill: false,
                tension: 0.2
            },
            {
                label: 'Wave (%)',
                data: waveArr,
                borderColor: '#50e3c2',
                backgroundColor: 'rgba(80,227,194,0.1)',
                fill: false,
                tension: 0.2
            }
        ]
    };
    const options = {
        responsive: true,
        plugins: {
            legend: { position: 'bottom' },
            title: { display: true, text: 'Renewable Energy Mix Trend (Next 24h)' }
        },
        scales: {
            y: { min: 0, max: 100, title: { display: true, text: '%' } }
        }
    };

    if (trendChart) {
        trendChart.data = data;
        trendChart.options = options;
        trendChart.update();
    } else {
        trendChart = new Chart(ctx, { type: 'line', data, options });
    }
}

windyInit(options, windyAPI => {
  const { map } = windyAPI;

  map.on('click', function (e) {
    const { lat, lng } = e.latlng;
    console.log("Clicked at:", lat, lng);

    fetchEnergyData(lat, lng).then(energyData => {
      if (energyData) {
        // --- INSTANTANEOUS MIX (uses current values in W/m²) ---
        let windValInst = parseFloat(energyData.windPower) || 0;
        let solarValInst = parseFloat(energyData.solar) || 0; // Use current solar radiation
        let waveValInst = parseFloat(energyData.wavePower) || 0;
        let totalInst = windValInst + solarValInst + waveValInst;

        let windPctInst = 0, solarPctInst = 0, wavePctInst = 0;
        if (totalInst > 0) {
          windPctInst = ((windValInst / totalInst) * 100).toFixed(0);
          solarPctInst = ((solarValInst / totalInst) * 100).toFixed(0);
          wavePctInst = ((waveValInst / totalInst) * 100).toFixed(0);
        }

        // --- DAILY MIX (uses daily solar, wind, and wave) ---
        let windValDay = parseFloat(energyData.windPower) || 0;
        let solarValDay = (parseFloat(energyData.solarEnergy) || 0) * 1000 / 24;
        let waveValDay = parseFloat(energyData.wavePower) || 0;
        let totalDay = windValDay + solarValDay + waveValDay;

        let windPctDay = 0, solarPctDay = 0, wavePctDay = 0;
        if (totalDay > 0) {
          windPctDay = ((windValDay / totalDay) * 100).toFixed(0);
          solarPctDay = ((solarValDay / totalDay) * 100).toFixed(0);
          wavePctDay = ((waveValDay / totalDay) * 100).toFixed(0);
        }

        // Show both mixes in the popup
        let mixSuggestion = `
          <b>Suggested Energy Mix (Current Hour):</b><br>
          Wind: ${windPctInst}%<br>
          Solar: ${solarPctInst}%<br>
          Wave: ${wavePctInst}%<br>
          <hr>
          <b>Suggested Energy Mix (Daily Avg):</b><br>
          Wind: ${windPctDay}%<br>
          Solar: ${solarPctDay}%<br>
          Wave: ${wavePctDay}%
        `;

        updateMixChart(windPctInst, solarPctInst, wavePctInst); // Show instantaneous mix in chart
        updateTrendChart(lat, lng);

        const factBanner = `
            <div style="background:#e6f7ff;border-radius:6px;padding:8px 10px;margin-bottom:8px;font-size:0.95em;color:#0077b6;">
                <b>Fun Fact:</b> ${getRandomFact()}
            </div>
        `;

        const content = `
          ${factBanner}
          <b>Timestamp:</b> ${energyData.timestamp}<br>
          <b title="Average wind speed at 10 meters above ground">Wind Speed:</b> ${energyData.wind} m/s<br>
          <b title="Estimated wind power per square meter">Wind Power:</b> ${energyData.windPower} W/m²<br>
          <b title="Solar radiation at ground level">Solar Radiation:</b> ${energyData.solar} W/m²<br>
          <b title="Estimated daily solar energy per square meter">Solar Energy Potential:</b> ${energyData.solarEnergy} kWh/m²/day<br>
          <b title="Average height of ocean waves">Wave Height:</b> ${energyData.waveHeight} m<br>
          <b title="Average time between wave peaks">Wave Period:</b> ${energyData.wavePeriod} s<br>
          <b title="Estimated wave power per meter of wave front">Wave Power:</b> ${energyData.wavePower} W/m<br>
          <hr>
          ${mixSuggestion}
        `;
        L.marker([lat, lng])
          .addTo(map)
          .bindPopup(content)
          .openPopup();
      }
    });
  });
});
