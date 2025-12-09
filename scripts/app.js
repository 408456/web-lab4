const API_KEY = '898e4299654d9a4abd2887387f0d2497';
let cities = JSON.parse(localStorage.getItem('cities') || '[]');
let currentCity = localStorage.getItem('currentCity') || null;

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

    navigator.geolocation.getCurrentPosition(
        pos => {
            const { latitude, longitude } = pos.coords;
            logger('Геопозиция получена', latitude, longitude);
            fetchWeatherByCoords(latitude, longitude)
                .then(data => {
                    currentCity = 'Текущее местоположение';
                    if (!cities.includes(currentCity)) cities.unshift(currentCity);
                    saveState();
                    renderApp();
                    logger('Текущее местоположение добавлено');
                })
                .catch(err => { logger('Ошибка fetch по координатам', err); renderApp(); });
        },
        () => {
            logger('Доступ к геопозиции отклонён');
            renderApp();
        }
    );
}

function saveState() {
    localStorage.setItem('cities', JSON.stringify(cities));
    if (cities.length) localStorage.setItem('currentCity', cities[0]);
    logger('Состояние сохранено', { cities, currentCity });
}

function renderApp() {
    const app = window.app;
    if (!app) return;
    while (app.firstChild) app.removeChild(app.firstChild);

    const refreshBtn = document.createElement('button');
    refreshBtn.textContent = 'Обновить';
    refreshBtn.addEventListener('click', () => { logger('Нажата кнопка "Обновить"'); loadWeather(); });
    app.appendChild(refreshBtn);

    const form = document.createElement('div');
    const input = document.createElement('input');
    input.placeholder = 'Введите город';
    input.addEventListener('input', () => logger('Пользователь вводит город:', input.value));

    const addBtn = document.createElement('button');
    addBtn.textContent = 'Добавить город';
    const errorMsg = document.createElement('div');
    errorMsg.className = 'error';

    addBtn.addEventListener('click', () => {
        const city = input.value.trim();
        logger('Попытка добавить город:', city);
        if (!city) return;
        if (cities.includes(city)) { errorMsg.textContent = 'Город уже добавлен'; return; }

        fetchWeather(city)
            .then(() => {
                cities.push(city);
                saveState();
                loadWeather();
                errorMsg.textContent = '';
                input.value = '';
                logger('Город успешно добавлен:', city);
            })
            .catch(err => {
                errorMsg.textContent = 'Некорректный город или ключ неактивен';
                logger('Ошибка добавления города:', city, err);
            });
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

function loadWeather() {
    const container = document.getElementById('cities-container');
    if (!container) return;
    while (container.firstChild) container.removeChild(container.firstChild);

    if (!cities.length) return;

    cities.forEach(city => {
        const card = document.createElement('div');
        card.className = 'city-card';
        const title = document.createElement('h3');
        title.textContent = city;
        card.appendChild(title);
        const loading = document.createElement('p');
        loading.textContent = 'Загрузка...';
        card.appendChild(loading);
        container.appendChild(card);

        fetchWeather(city)
            .then(data => {
                card.removeChild(loading);
                logger('Погода загружена для города:', city);

                const temp = data.main.temp;
                const desc = data.weather[0].description;

                const p = document.createElement('p');
                p.textContent = `Температура: ${temp}°C, ${desc}`;
                card.appendChild(p);
            })
            .catch(err => {
                card.removeChild(loading);
                const errMsg = document.createElement('p');
                errMsg.style.color = 'red';
                errMsg.textContent = 'Ошибка загрузки (проверь ключ API)';
                card.appendChild(errMsg);
                logger('Ошибка загрузки погоды для города:', city, err);
            });
    });
}

async function fetchWeather(city) {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&lang=ru&appid=${API_KEY}`;
    const res = await fetch(url);
    if (res.status === 401) throw new Error('401 Unauthorized - ключ не активен');
    if (!res.ok) throw new Error('Ошибка запроса');
    return res.json();
}

async function fetchWeatherByCoords(lat, lon) {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=ru&appid=${API_KEY}`;
    const res = await fetch(url);
    if (res.status === 401) throw new Error('401 Unauthorized - ключ не активен');
    if (!res.ok) throw new Error('Ошибка запроса');
    return res.json();
}
