// ==========================================================
// 1. CONFIGURACIÓN Y VARIABLES GLOBALES
// ==========================================================
const supabaseUrl = 'https://bsxllefnehbwkuqbelec.supabase.co';
// 🚨 CORRECCIÓN DE SINTAXIS: Se agrega la comilla simple de cierre.
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzeGxsZWZuZWhid2t1cWJlbGVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NjQzMTksImV4cCI6MjA3MzA0MDMxOX0.Ma8elbehsraBPzPwSmntE78NaAfTgBKgDW_hMb-ohhg'; 

// Inicialización del cliente Supabase
const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);

// Variables de estado global
let currentUser = null;
let selectedTable = null;

// 🚨 AQUÍ VA LA NUEVA LÍNEA: Referencia al botón de Login. 🚨
//    Esto debe ir antes de las funciones que lo usan.
const loginButton = document.getElementById('loginButton'); 

// Definición de Turnos ATTF (Horarios en formato 24h)
// horaFinGracia: La hora hasta la que se permite la selección/reingreso.
const TURNOS_ATTF = {
    '6am-2pm': { nombre: 'Turno 1 (6 AM - 2 PM)', horaInicioGracia: 4, horaFinGracia: 10, horaFin: 14, codigo: '6am-2pm' },
    '8am-4pm': { nombre: 'Turno 4 (8 AM - 4 PM)', horaInicioGracia: 5, horaFinGracia: 10, horaFin: 16, codigo: '8am-4pm' },
    '2pm-10pm': { nombre: 'Turno 2 (2 PM - 10 PM)', horaInicioGracia: 11, horaFinGracia: 17, horaFin: 22, codigo: '2pm-10pm' },
    '10pm-6am': { nombre: 'Turno 3 (10 PM - 6 AM)', horaInicioGracia: 20, horaFinGracia: 9, horaFin: 6, codigo: '10pm-6am' }
};

// ==========================================================
// 2. FUNCIONES DE SEGURIDAD Y ESTADO
// ==========================================================

// --- Función Auxiliar: Verificar si el usuario está en horario permitido (A COMPLETAR) ---
function verificarHorarioPermitido(rol) {
    // Esta función debe existir para que login() no falle.
    // Asumimos que siempre permite la entrada para esta demostración.
    return { permitido: true, mensaje: '' };
}

// --- Función Auxiliar: Guardar datos en localStorage (persistencia) ---
function guardarDatosOffline() {
    if (currentUser) {
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
    }
}

// --- Función de Cierre de Sesión Universal ---
async function logout() {
    // 1. Limpiar variables de sesión del navegador
    sessionStorage.removeItem('cleca_user_session');
    sessionStorage.removeItem('attf_last_turn');
    localStorage.removeItem('currentUser'); // Limpiar persistencia

    if (currentUser) {
        // 2. Limpiar la sesión en la base de datos (Supabase)
        await supabaseClient
            .from('usuarios')
            .update({ sessionactiva: false, sessiontoken: null })
            .eq('id', currentUser.id);
    }

    // 3. Reiniciar las variables en memoria y recargar
    currentUser = null;
    selectedTable = null;
    window.location.reload();
}

// --- Función para verificar la sesión activa en la DB (para inactividad) ---
function iniciarVerificacionSesion() {
    setInterval(async () => {
        if (!currentUser) return;

        try {
            const { data, error } = await supabaseClient
                .from('usuarios')
                .select('sessionactiva, sessiontoken, ultimaconexion')
                .eq('id', currentUser.id)
                .single();

            if (!data || !data.sessionactiva || data.sessiontoken !== currentUser.session_token) {
                if (data && data.sessiontoken && data.sessiontoken !== currentUser.session_token) {
                    alert('Su sesión ha sido iniciada en otro dispositivo.');
                }
                logout();
                return;
            }

            const ultima = new Date(data.ultimaconexion);
            const ahora = new Date();
            const diffMin = (ahora - ultima) / 1000 / 60;

            if (diffMin > 45) {
                alert('Su sesión ha expirado por inactividad.');
                logout();
            }
        } catch (err) {
            console.error('Error verificando sesión:', err);
        }
    }, 30000); // Cada 30 segundos
}

// --- Función para renovar la conexión (usada al buscar) ---
async function renovarSesion() {
    if (!currentUser) return;
    await supabaseClient
        .from('usuarios')
        .update({ ultimaconexion: new Date().toISOString() })
        .eq('id', currentUser.id);
}

// ==========================================================
// 3. LÓGICA DE TURNOS ATTF
// ==========================================================

// --- Función para programar cierre por fin de turno ---
function programarCierreSesion(turno) {
    const ahora = new Date();
    let fechaCierre = new Date();
    
    // Calcula la hora de corte real (3 horas después de la horaFin oficial)
    let horaCorte = turno.horaFin + 3; 

    if (turno.codigo === '10pm-6am') {
        // Turno nocturno: Corte a las 9 AM (6+3)
        horaCorte = 9;
        
        if (ahora.getHours() >= turno.horaInicioGracia) { // Si inició en la noche (20:00)
            fechaCierre.setDate(fechaCierre.getDate() + 1);
        }
        fechaCierre.setHours(horaCorte, 0, 0, 0);
    } else {
        // Turno diurno
        fechaCierre.setHours(horaCorte, 0, 0, 0);
    }
    
    const tiempoRestante = fechaCierre.getTime() - ahora.getTime();
    
    if (tiempoRestante > 0) {
        // Esto es solo un respaldo, el verificarCorteTurno hace el chequeo periódico
        setTimeout(() => {
            alert('Su turno ha terminado. La sesión se cerrará automáticamente.');
            logout();
        }, tiempoRestante);
    }
}

// --- Función Periódica para verificar el corte del turno ---
function verificarCorteTurno() {
    if (!currentUser || currentUser.rol !== 'ATTF' || !currentUser.turnoAsignado) {
        return; 
    }

    const ahora = new Date();
    const horaActual = ahora.getHours();
    
    const turnoActual = TURNOS_ATTF[currentUser.turnoAsignado];
    
    let horaCorteReal = turnoActual.horaFin + 3; 

    if (turnoActual.codigo === '10pm-6am') {
        horaCorteReal = 9; // 9 AM
        
        // Comprobación de turno nocturno: si la hora actual está entre 1 AM y 9 AM
        if (horaActual >= 1 && horaActual < horaCorteReal) {
            alert('Su turno nocturno ha finalizado. Se cerrará su sesión.');
            logout();
            return;
        }
    } else {
        // Comprobación de turnos diurnos (Ej. corte entre 17:00 y 19:00)
        if (horaActual >= horaCorteReal) {
            alert('Su turno ha finalizado. Se cerrará su sesión.');
            logout();
            return;
        }
    }
}


// --- FUNCIÓN PARA SELECCIONAR EL TURNO ---
function seleccionarTurno(codigoTurno) {
    const turno = TURNOS_ATTF[codigoTurno];
    const ahora = new Date();

    // 1. Validar la Regla de Turno Único
    if (currentUser.turnoAsignado) {
        alert('Error: Ya tiene un turno asignado y activo. Debe cerrar sesión para finalizar el turno actual.');
        return; 
    }

    // 2. Asignar y Guardar el Turno en el objeto currentUser
    currentUser.turnoAsignado = codigoTurno;
    currentUser.turnoNombre = turno.nombre;
    currentUser.diaIngreso = ahora.toDateString(); 
    
    // Guardar en localStorage (persistencia)
    guardarDatosOffline(); 
    
    // 3. Programar cierre automático periódico (CRÍTICO)
    setInterval(verificarCorteTurno, 5 * 60 * 1000); // Cada 5 minutos

    // 4. Actualizar la interfaz y continuar
    document.getElementById('currentUser').textContent = `Bienvenido, ${currentUser.usuario} - ${turno.nombre}`;
    document.getElementById('userInfo').classList.remove('hidden');
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('tableSelectionSection').style.display = 'block';
    
    iniciarVerificacionSesion(); // Inicia la verificación de inactividad
    mostrarTablasSegunRol();
}


// --- FUNCIÓN PARA MOSTRAR LA SELECCIÓN DE TURNO ---
function mostrarSeleccionTurno() {
    const ahora = new Date();
    const horaActual = ahora.getHours();
    const turnosDisponibles = [];
    const diaActual = ahora.toDateString();
    
    const lastSession = JSON.parse(sessionStorage.getItem('attf_last_turn'));
    
    // LÓGICA DE REINGRESO (Si ya eligió un turno hoy)
    if (lastSession && lastSession.dia === diaActual && TURNOS_ATTF[lastSession.turnoKey]) {
        const turnoAnterior = TURNOS_ATTF[lastSession.turnoKey];
        // Verificar si el turno anterior aún está en su ventana de gracia (horaFinGracia)
        
        let turnoAunValido = false;
        
        // Lógica de validación de turno nocturno (que pasa de 20 a 9)
        if (turnoAnterior.horaFinGracia < turnoAnterior.horaInicioGracia) {
            // Turno nocturno (10pm-6am): Válido si estás entre 20:00 y 09:00 AM
            turnoAunValido = horaActual >= turnoAnterior.horaInicioGracia || horaActual < turnoAnterior.horaFinGracia;
        } else {
            // Turnos diurnos: Válido si estás entre horaInicioGracia y horaFinGracia
            turnoAunValido = horaActual >= turnoAnterior.horaInicioGracia && horaActual < turnoAnterior.horaFinGracia;
        }

        if (turnoAunValido) {
            // Permitir SOLO reingreso
            turnosDisponibles.push({ 
                key: lastSession.turnoKey, 
                ...turnoAnterior, 
                descripcion: "Continuar en tu turno de hoy" 
            });
        } else {
            alert('Tu turno de hoy ha finalizado. Podrás acceder nuevamente mañana.');
            logout();
            return;
        }
    } else {
        // PRIMER INGRESO DEL DÍA: Mostrar turnos según hora actual
        Object.entries(TURNOS_ATTF).forEach(([key, turno]) => {
            let puedeIngresar = false;
            
            if (turno.horaFinGracia < turno.horaInicioGracia) {
                // Turno nocturno (10 PM - 6 AM)
                // Permitir ingreso SOLO en la ventana de inicio (20:00 en adelante)
                if (horaActual >= turno.horaInicioGracia) {
                    puedeIngresar = true;
                }
            } else {
                // Turnos diurnos
                // 🚨 CORRECCIÓN DE VISIBILIDAD: Usar horaFinGracia
                if (horaActual >= turno.horaInicioGracia && horaActual < turno.horaFinGracia) {
                    puedeIngresar = true;
                }
            }
            
            if (puedeIngresar) {
                turnosDisponibles.push({ key, ...turno, descripcion: "Turno disponible" });
            }
        });
    }
    
    if (turnosDisponibles.length === 0) {
        alert('No hay turnos disponibles para seleccionar. O ya expiró el de hoy.');
        logout();
        return;
    }
    
    // Renderizado de la selección de turno (Ajusta los IDs de tus elementos HTML)
    const loginSection = document.getElementById('loginSection');
    loginSection.innerHTML = `
        <img src="https://cdnimg.bnamericas.com/HFvkiBpeoLTFyPBTjytdbdohtBDrWQsnxgYaUwIlxAEFZVYKsYrwygPFBPYYlShO.png" alt="Logo CLESA" class="logo">
        <h1 class="titulo-degradado">CLESA</h1>
        <p class="subtitulo">Seleccione su Turno de Trabajo</p>
        
        <div class="table-selector">
            ${turnosDisponibles.map(turno => `
                <div class="table-option" onclick="seleccionarTurno('${turno.key}')">
                    <span class="table-icon">🕐</span>
                    <div class="table-title">${turno.nombre}</div>
                    <div class="table-description">${turno.descripcion}</div>
                </div>
            `).join('')}
        </div>
        <button class="btn btn-danger" onclick="logout()" style="margin-top: 20px;">Cancelar</button>
    `;
}

// ==========================================================
// 4. LÓGICA DE LOGIN Y AUTENTICACIÓN
// ==========================================================

// --- FUNCIÓN PRINCIPAL DE LOGIN (Sustituye la autenticación nativa por la manual) ---
async function login() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    
    if (!username || !password) {
        alert('Por favor ingrese usuario y contraseña');
        return;
    }

    try {
        // Bloque de verificación de sesión única (COMENTADO para evitar problemas móviles)
        /*
        const { data: existingSession } = await supabaseClient
            .from('usuarios')
            .select('*')
            .eq('usuario', username)
            .eq('sessionactiva', true)
            .maybeSingle();

        if (existingSession) {
            const confirmar = confirm('Este usuario ya tiene una sesión activa en otro dispositivo. ¿Desea cerrar la sesión anterior y continuar?');
            if (!confirmar) return;

            await supabaseClient
                .from('usuarios')
                .update({ sessionactiva: false, sessiontoken: null })
                .eq('usuario', username);
        }
        */

        // Autenticar usuario con tu tabla 'usuarios'
        const { data, error } = await supabaseClient
            .from('usuarios')
            .select('*')
            .eq('usuario', username)
            .eq('password', password)
            .eq('activo', true)
            .single();

        if (error || !data) {
            alert('Usuario o contraseña incorrectos');
            return;
        }

        // Verificar horario permitido
        const verificacion = verificarHorarioPermitido(data.rol);
        if (!verificacion.permitido) {
            alert(verificacion.mensaje);
            return;
        }

        // Crear sesión en DB
        const sessionToken = btoa(username + Date.now() + Math.random());
        await supabaseClient
            .from('usuarios')
            .update({
                sessionactiva: true,
                sessiontoken: sessionToken,
                ultimaconexion: new Date().toISOString()
            })
            .eq('id', data.id);

        currentUser = { ...data, session_token: sessionToken };

        // 🚨 REDIRECCIÓN ATTF: Mostrar selección de turno
        if (data.rol === 'ATTF') {
            mostrarSeleccionTurno();
            return;
        }

        // Para otros roles, continuar normal
        document.getElementById('currentUser').textContent = `Bienvenido, ${data.usuario}`;
        document.getElementById('userInfo').classList.remove('hidden');
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('tableSelectionSection').style.display = 'block';

        iniciarVerificacionSesion();
        guardarDatosOffline();
        mostrarTablasSegunRol(); // Filtra los módulos según el rol
        
    } catch (err) {
        console.error('Error de login:', err);
        alert('Error de conexión. Por favor intente nuevamente.');
    }
}


// --- FUNCIÓN PARA VERIFICAR PERSISTENCIA ---
function verificarDatosOffline() {
    const storedUser = localStorage.getItem('currentUser');
    
    if (storedUser) {
        currentUser = JSON.parse(storedUser); 
        
        // 🚨 LÓGICA CLAVE: Si ya hay un turno asignado, saltamos la selección de turnos.
        if (currentUser.rol === 'ATTF' && currentUser.turnoAsignado) {
            // Cargar menú principal y saltar selección de turnos
            document.getElementById('appContent').style.display = 'block';
            document.getElementById('loginSection').style.display = 'none';
            document.getElementById('tableSelectionSection').style.display = 'block';
            
            document.getElementById('currentUser').textContent = `Bienvenido, ${currentUser.usuario} - ${TURNOS_ATTF[currentUser.turnoAsignado].nombre}`;

            mostrarTablasSegunRol(); 
            // Inicia la verificación periódica del corte del turno
            setInterval(verificarCorteTurno, 5 * 60 * 1000); 

            return true;
        }

        // Si es otro rol, reingresa directo al menú de módulos
        if (currentUser.rol !== 'ATTF') {
            document.getElementById('appContent').style.display = 'block';
            document.getElementById('loginSection').style.display = 'none';
            document.getElementById('tableSelectionSection').style.display = 'block';
            mostrarTablasSegunRol();
            return true; 
        }
    }
    return false;
}

// ==========================================================
// 5. LÓGICA DE UI Y BÚSQUEDA (Necesitas tus configuraciones aquí)
// ==========================================================

// --- FUNCIÓN PARA FILTRAR MÓDULOS (usa el mismo HTML que tenías) ---
function mostrarTablasSegunRol() {
    if (!currentUser || !currentUser.rol) {
        console.log('❌ currentUser no está disponible');
        return;
    }
    // Asegúrate de que tus botones de módulos tengan la clase '.table-option'
    const tableOptions = document.querySelectorAll('.table-option'); 
    
    // (Tu lógica de filtrado según rol, asumiendo que el onclick identifica el módulo)
    if (currentUser.rol === 'Lectura') {
        tableOptions.forEach(option => {
            const onclick = option.getAttribute('onclick');
            if (!onclick.includes('consultas_servicios')) {
                option.style.display = 'none';
            } else {
                option.style.display = 'block';
            }
        });
    } else if (currentUser.rol === 'ATTF') {
        tableOptions.forEach(option => {
            const onclick = option.getAttribute('onclick');
            if (onclick.includes('consultas_servicios') || onclick.includes('TX y Cortes')) {
                option.style.display = 'block';
            } else {
                option.style.display = 'none';
            }
        });
    } else {
        // Contratista, Supervisor, Consulta y otros: Acceso completo
        tableOptions.forEach(option => {
            option.style.display = 'block';
        });
    }
}

// ... (El resto de tus funciones de búsqueda: buscar, generarCamposBusqueda, volverATablas, etc. deben ir aquí) ...

// ==========================================================
// 6. INICIALIZACIÓN DE LA APLICACIÓN
// ==========================================================
// ... (El resto de tus funciones y lógica) ...

// ==========================================================
// 6. INICIALIZACIÓN DE LA APLICACIÓN
// ==========================================================
window.addEventListener('load', function() {
    
    // 1. Intenta restaurar la sesión persistente
    if (!verificarDatosOffline()) {
        // Si no hay sesión, muestra el formulario de login
        document.getElementById('loginSection').style.display = 'block';
    }
    
    // 2. 🚨 ASIGNAR EL EVENTO DE CLIC DEL BOTÓN DE LOGIN 🚨
    //    (Debe ir FUERA del if, para asegurar que siempre se asigne, 
    //     si el botón existe en el DOM).
    const loginButton = document.getElementById('loginButton'); // Asegúrate de que este ID existe en tu HTML
    
    if (loginButton) {
        // Asigna la función 'login' al hacer clic, evitando el 'onclick' en el HTML.
        loginButton.addEventListener('click', function(e) {
            e.preventDefault(); // Detiene el envío normal del formulario (si aplica)
            login();
        });
    }
});
