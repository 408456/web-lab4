const API_KEY = '898e4299654d9a4abd2887387f0d2497';
let cities = JSON.parse(localStorage.getItem('cities') || '[]');
let currentCity = localStorage.getItem('currentCity') || null;
let geoBlocked = JSON.parse(localStorage.getItem('geoBlocked') || 'false');

function logger(...args) {
    console.log('[WeatherApp]', ...args);
}

document.addEventListener('DOMContentLoaded', () => {
    const app = document.getElementById('app');
    if (!app) { console.error('#app не найден'); return; }
    window.app = app;
    logger('Приложение запущено');
    startApp();
});

function startApp() {
    getLocationOrRender();
}

function getLocationOrRender() {
    if (!navigator.geolocation) {
        logger('Геопозиция недоступна');
        renderApp();
        return;
    }

    if (geoBlocked) {
        logger('Геопозиция ранее заблокирована пользователем');
        renderApp();
        return;
    }

    navigator.geolocation.getCurrentPosition(
        pos => {
            const { latitude, longitude } = pos.coords;
            logger('Геопозиция получена', latitude, longitude);
            fetchWeatherByCoords(latitude, longitude)
                .then(data => {
                    currentCity = 'Текущее местоположение';
                    if (!cities.includes(currentCity)) cities.unshift(currentCity);
                    saveState();
                    localStorage.setItem('currentCoords', JSON.stringify({ lat: latitude, lon: longitude }));
                    renderApp();
                    logger('Текущее местоположение добавлено');
                })
                .catch(err => { logger('Ошибка fetch по координатам', err); renderApp(); });
        },
        err => {
            logger('Доступ к геопозиции отклонён', err);
            if (err && err.code === 1) { 
                geoBlocked = true;
                localStorage.setItem('geoBlocked', 'true');
            }
            renderApp();
        }
    );
}

function saveState() {
    localStorage.setItem('cities', JSON.stringify(cities));
    if (cities.length) localStorage.setItem('currentCity', cities[0]);
    localStorage.setItem('geoBlocked', JSON.stringify(geoBlocked));
    logger('Состояние сохранено', { cities, currentCity, geoBlocked });
}

function renderApp() {
    const app = window.app;
    if (!app) return;
    while (app.firstChild) app.removeChild(app.firstChild);

    const topBar = document.createElement('div');
    topBar.className = 'topbar';

    const refreshBtn = document.createElement('button');
    refreshBtn.textContent = 'Обновить';
    refreshBtn.addEventListener('click', () => { logger('Нажата кнопка "Обновить"'); loadWeather(); });
    topBar.appendChild(refreshBtn);

    if (geoBlocked) {
        const geoRetryBtn = document.createElement('button');
        geoRetryBtn.textContent = 'Разрешить геопозицию';
        geoRetryBtn.addEventListener('click', () => {
            logger('Пользователь пытается повторно запросить геопозицию');
            geoBlocked = false;
            localStorage.setItem('geoBlocked', 'false');
            navigator.geolocation.getCurrentPosition(
                pos => {
                    const { latitude, longitude } = pos.coords;
                    logger('Геопозиция получена после повторного запроса', latitude, longitude);
                    fetchWeatherByCoords(latitude, longitude)
                        .then(() => {
                            currentCity = 'Текущее местоположение';
                            if (!cities.includes(currentCity)) cities.unshift(currentCity);
                            localStorage.setItem('currentCoords', JSON.stringify({ lat: latitude, lon: longitude }));
                            saveState();
                            renderApp();
                        })
                        .catch(err => {
                            logger('Ошибка при fetch после получения координат', err);
                            renderApp();
                        });
                },
                e => {
                    logger('Повторный запрос геопозиции отклонён', e);
                    if (e && e.code === 1) {
                        geoBlocked = true;
                        localStorage.setItem('geoBlocked', 'true');
                    }
                    renderApp();
                }
            );
        });
        topBar.appendChild(geoRetryBtn);
    }

    app.appendChild(topBar);

    const form = document.createElement('div');
    form.className = 'add-form';

    const input = document.createElement('input');
    input.placeholder = 'Введите город';
    input.autocomplete = 'off';
    input.addEventListener('input', () => logger('Пользователь вводит город:', input.value));

    const addBtn = document.createElement('button');
    addBtn.textContent = 'Добавить город';

    const errorMsg = document.createElement('div');
    errorMsg.className = 'error';

    addBtn.addEventListener('click', async () => {
        const city = input.value.trim();
        logger('Попытка добавить город:', city);
        if (!city) return;
        if (cities.includes(city)) { errorMsg.textContent = 'Город уже добавлен'; return; }

        try {
            const forecast = await fetchForecast(city);
            cities.push(city);
            saveState();
            loadWeather();
            errorMsg.textContent = '';
            input.value = '';
            logger('Город успешно добавлен:', city, forecast);
        } catch (err) {
            errorMsg.textContent = 'Некорректный город или ключ неактивен';
            logger('Ошибка добавления города:', city, err);
        }
    });

    form.appendChild(input);
    form.appendChild(addBtn);
    form.appendChild(errorMsg);
    app.appendChild(form);

    const container = document.createElement('div');
    container.id = 'cities-container';
    app.appendChild(container);

    loadWeather();
}

async function loadWeather() {
    const container = document.getElementById('cities-container');
    if (!container) return;
    while (container.firstChild) container.removeChild(container.firstChild);

    const coords = JSON.parse(localStorage.getItem('currentCoords') || 'null');
    if (!cities.length && coords) {
        await renderCityCardCoords('Текущее местоположение', coords.lat, coords.lon, container);
        return;
    }

    if (!cities.length) return;

    for (const city of cities) {
        await renderCityCard(city, container);
    }
}

async function renderCityCard(city, container) {
    const card = document.createElement('div');
    card.className = 'city-card';

    const header = document.createElement('div');
    header.className = 'card-header';

    const title = document.createElement('h3');
    title.textContent = city;

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Удалить';
    delBtn.addEventListener('click', () => {
        logger('Удаление города:', city);
        cities = cities.filter(c => c !== city);
        saveState();
        loadWeather();
    });

    header.appendChild(title);
    header.appendChild(delBtn);
    card.appendChild(header);

    const loading = document.createElement('p');
    loading.textContent = 'Загрузка...';
    card.appendChild(loading);
    container.appendChild(card);

    try {
        const [current, forecast] = await Promise.all([fetchWeather(city), fetchForecast(city)]);
        card.removeChild(loading);
        logger('Погода загружена для города:', city);

        const curBlock = document.createElement('div');
        curBlock.className = 'current-weather';
        const temp = current.main.temp;
        const desc = current.weather[0].description;
        curBlock.textContent = `Текущая: ${temp}°C, ${desc}`;
        card.appendChild(curBlock);

        const forecastBlock = document.createElement('div');
        forecastBlock.className = 'forecast-3days';
        const titleForecast = document.createElement('h4');
        titleForecast.textContent = 'Прогноз (3 дня):';
        forecastBlock.appendChild(titleForecast);

        forecast.slice(0, 3).forEach(day => {
            const p = document.createElement('p');
            p.textContent = `${day.date}: ${day.temp}°C, ${day.desc}`;
            forecastBlock.appendChild(p);
        });

        card.appendChild(forecastBlock);
    } catch (err) {
        card.removeChild(loading);
        const errMsg = document.createElement('p');
        errMsg.style.color = 'red';
        errMsg.textContent = 'Ошибка загрузки (проверь ключ API)';
        card.appendChild(errMsg);
        logger('Ошибка загрузки погоды для города:', city, err);
    }
}

async function renderCityCardCoords(label, lat, lon, container) {
    const city = label;
    const card = document.createElement('div');
    card.className = 'city-card';

    const header = document.createElement('div');
    header.className = 'card-header';

    const title = document.createElement('h3');
    title.textContent = city;

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Удалить';
    delBtn.addEventListener('click', () => {
        logger('Удаление текущего местоположения:', city);
        localStorage.removeItem('currentCoords');
        currentCity = null;
        cities = cities.filter(c => c !== city);
        saveState();
        loadWeather();
    });

    header.appendChild(title);
    header.appendChild(delBtn);
    card.appendChild(header);

    const loading = document.createElement('p');
    loading.textContent = 'Загрузка...';
    card.appendChild(loading);
    container.appendChild(card);

    try {
        const [current, forecast] = await Promise.all([fetchWeatherByCoords(lat, lon), fetchForecastByCoords(lat, lon)]);
        card.removeChild(loading);
        logger('Погода загружена для coords:', lat, lon);

        const curBlock = document.createElement('div');
        curBlock.className = 'current-weather';
        const temp = current.main.temp;
        const desc = current.weather[0].description;
        curBlock.textContent = `Текущая: ${temp}°C, ${desc}`;
        card.appendChild(curBlock);

        const forecastBlock = document.createElement('div');
        forecastBlock.className = 'forecast-3days';
        const titleForecast = document.createElement('h4');
        titleForecast.textContent = 'Прогноз (3 дня):';
        forecastBlock.appendChild(titleForecast);

        forecast.slice(0, 3).forEach(day => {
            const p = document.createElement('p');
            p.textContent = `${day.date}: ${day.temp}°C, ${day.desc}`;
            forecastBlock.appendChild(p);
        });

        card.appendChild(forecastBlock);
    } catch (err) {
        card.removeChild(loading);
        const errMsg = document.createElement('p');
        errMsg.style.color = 'red';
        errMsg.textContent = 'Ошибка загрузки (проверь ключ API)';
        card.appendChild(errMsg);
        logger('Ошибка загрузки погоды для coords:', lat, lon, err);
    }
}

async function fetchWeather(city) {
    const url =
        `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&lang=ru&appid=${API_KEY}`;
    const res = await fetch(url);
    if (res.status === 401) throw new Error('401 Unauthorized - ключ не активен');
    if (!res.ok) throw new Error('Ошибка запроса');
    return res.json();
}

async function fetchWeatherByCoords(lat, lon) {
    const url =
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=ru&appid=${API_KEY}`;
    const res = await fetch(url);
    if (res.status === 401) throw new Error('401 Unauthorized - ключ не активен');
    if (!res.ok) throw new Error('Ошибка запроса');
    return res.json();
}

async function fetchForecast(city) {
    const url =
        `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&units=metric&lang=ru&appid=${API_KEY}`;
    const res = await fetch(url);
    if (res.status === 401) throw new Error('401 Unauthorized - ключ не активен');
    if (!res.ok) throw new Error('Ошибка запроса');
    const data = await res.json();
    return convertForecastListToDays(data.list);
}

async function fetchForecastByCoords(lat, lon) {
    const url =
        `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&lang=ru&appid=${API_KEY}`;
    const res = await fetch(url);
    if (res.status === 401) throw new Error('401 Unauthorized - ключ не активен');
    if (!res.ok) throw new Error('Ошибка запроса');
    const data = await res.json();
    return convertForecastListToDays(data.list);
}

function convertForecastListToDays(list) {
    // list: элементы с полем dt_txt = "YYYY-MM-DD HH:MM:SS"
    const daysMap = {};
    list.forEach(item => {
        const date = item.dt_txt.split(' ')[0];
        if (!daysMap[date]) daysMap[date] = [];
        daysMap[date].push(item);
    });

    const dates = Object.keys(daysMap).sort();
    const result = [];
    for (let i = 0; i < dates.length && result.length < 3; i++) {
        const date = dates[i];
        const items = daysMap[date];
        let chosen = items.find(it => it.dt_txt.includes('12:00:00')) || items[Math.floor(items.length / 2)];
        const temp = Math.round(chosen.main.temp);
        const desc = chosen.weather[0].description;
        result.push({ date, temp, desc });
    }
    return result;
}
