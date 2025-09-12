// Reemplaza con tus credenciales de Supabase
const supabaseUrl = 'TU_URL_DE_SUPABASE';
const supabaseAnonKey = 'TU_ANON_KEY_DE_SUPABASE';

const supabase = supabase.createClient(supabaseUrl, supabaseAnonKey);

// Referencias a los elementos del DOM
const authContainer = document.getElementById('auth-container');
const mainContainer = document.getElementById('main-container');
const loginForm = document.getElementById('login-form');
const logoutButton = document.getElementById('logout-button');
const errorMessage = document.getElementById('error-message');
const userEmailSpan = document.getElementById('user-email');
const tableButtons = document.querySelectorAll('.table-button');
const searchFormContainer = document.getElementById('search-form-container');
const resultsContainer = document.getElementById('results-container');
const currentTableTitle = document.getElementById('current-table-title');

// Definición de las tablas y sus campos de búsqueda
const tablesConfig = {
    'Consumos': {
        title: 'Búsqueda de Consumos',
        searchFields: ['cuentacontrato', 'medidor']
    },
    'Coordenadas': {
        title: 'Búsqueda de Coordenadas',
        searchFields: ['Medidor', 'CuentaContrato']
    },
    'OS Pendientes': {
        title: 'Búsqueda de OS Pendientes',
        searchFields: ['OSATMO', 'OSSAP', 'CuentaContrato', 'Medidor']
    },
    'OSCerradas': {
        title: 'Búsqueda de OS Cerradas',
        searchFields: ['OSATOMO', 'OSSAP', 'CuentaContrato', 'Medidor']
    },
    'TX y Cortes': {
        title: 'Búsqueda de TX y Cortes',
        searchFields: ['TXCortes', 'Circuitos']
    }
};

// --- Manejo de la Sesión ---

// Función para verificar el estado de la sesión al cargar la página
async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        showMainContent(session.user);
    } else {
        showAuthContent();
    }
}

// Función para manejar el inicio de sesión
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = loginForm.querySelector('#email').value;
    const password = loginForm.querySelector('#password').value;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        errorMessage.textContent = 'Error: ' + error.message;
        console.error('Error de autenticación:', error);
    } else {
        // Lógica para cerrar sesión en otros dispositivos (solución manual)
        // Puedes guardar el ID de la sesión actual en una tabla para validarlo
        const { data: userSessionData, error: userSessionError } = await supabase
            .from('sessions_tracker') // Crear esta tabla en Supabase
            .select('*')
            .eq('user_id', data.user.id)
            .single();

        if (userSessionData && userSessionData.session_id !== data.session.id) {
            // Si hay una sesión registrada diferente, la invalidamos
            await supabase.auth.signOut({ scope: 'global' });
            errorMessage.textContent = 'Ya has iniciado sesión en otro dispositivo. Por favor, vuelve a intentarlo.';
            showAuthContent();
            return;
        }

        if (!userSessionData) {
            // Si no hay sesión, la registramos
            await supabase
                .from('sessions_tracker')
                .insert([{ user_id: data.user.id, session_id: data.session.id }]);
        }

        showMainContent(data.user);
    }
});

// Función para manejar el cierre de sesión
logoutButton.addEventListener('click', async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error('Error al cerrar sesión:', error);
    }
    showAuthContent();
});

// Funciones para mostrar u ocultar secciones
function showAuthContent() {
    authContainer.style.display = 'block';
    mainContainer.style.display = 'none';
    errorMessage.textContent = '';
    loginForm.reset();
}

function showMainContent(user) {
    authContainer.style.display = 'none';
    mainContainer.style.display = 'flex';
    userEmailSpan.textContent = user.email;
}

// --- Manejo del Menú y los Formularios ---

tableButtons.forEach(button => {
    button.addEventListener('click', () => {
        const tableName = button.getAttribute('data-table');
        displaySearchForm(tableName);
    });
});

function displaySearchForm(tableName) {
    const config = tablesConfig[tableName];
    currentTableTitle.textContent = config.title;
    searchFormContainer.innerHTML = '';
    resultsContainer.innerHTML = '';

    const form = document.createElement('form');
    form.id = 'search-form';

    config.searchFields.forEach(field => {
        const label = document.createElement('label');
        label.textContent = field + ':';
        const input = document.createElement('input');
        input.type = 'text';
        input.id = `search-${field}`;
        input.name = field;
        form.appendChild(label);
        form.appendChild(input);
    });

    const searchButton = document.createElement('button');
    searchButton.type = 'submit';
    searchButton.textContent = 'Buscar';
    form.appendChild(searchButton);

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const searchValues = Object.fromEntries(formData.entries());
        fetchData(tableName, searchValues);
    });

    searchFormContainer.appendChild(form);
}

// --- Obtención y Visualización de Datos ---

async function fetchData(tableName, searchValues) {
    let query = supabase.from(tableName).select('*');

    // Filtra la consulta por los valores de búsqueda
    for (const field in searchValues) {
        if (searchValues[field]) {
            query = query.eq(field, searchValues[field]);
        }
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error al obtener datos:', error);
        resultsContainer.innerHTML = '<p>Error al cargar los datos.</p>';
    } else {
        displayResults(data, tableName);
    }
}

function displayResults(data, tableName) {
    resultsContainer.innerHTML = '';

    if (data.length === 0) {
        resultsContainer.innerHTML = '<p>No se encontraron resultados.</p>';
        return;
    }

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    // Crea el encabezado de la tabla
    const headerRow = document.createElement('tr');
    Object.keys(data[0]).forEach(key => {
        const th = document.createElement('th');
        th.textContent = key;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Llena la tabla con los datos
    data.forEach(item => {
        const row = document.createElement('tr');
        for (const key in item) {
            const td = document.createElement('td');
            const value = item[key];
            
            // Lógica para botones
            if (key.includes('Coordenadas') || key.includes('FotoLink') || key.includes('Fotolink')) {
                const button = document.createElement('button');
                button.textContent = `Ver ${key}`;
                button.onclick = () => handleButtonClick(key, value);
                td.appendChild(button);
            } else {
                td.textContent = value;
            }
            row.appendChild(td);
        }
        tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    resultsContainer.appendChild(table);
}

function handleButtonClick(key, value) {
    if (key.includes('Coordenadas')) {
        // Ejemplo de lógica para coordenadas
        alert(`Las coordenadas son: ${value}`);
        // Aquí podrías abrir un mapa de Google Maps con las coordenadas
        // window.open(`https://www.google.com/maps?q=${value}`, '_blank');
    } else if (key.includes('FotoLink') || key.includes('Fotolink')) {
        // Ejemplo de lógica para fotos
        window.open(value, '_blank');
    }
}

// Inicializa la aplicación
checkSession();