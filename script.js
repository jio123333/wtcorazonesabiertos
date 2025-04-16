document.addEventListener('DOMContentLoaded', function() {
    // Elementos del DOM
    const usernameInput = document.getElementById('username');
    const setUsernameBtn = document.getElementById('set-username');
    const channelUpBtn = document.getElementById('channel-up');
    const channelDownBtn = document.getElementById('channel-down');
    const volumeUpBtn = document.getElementById('volume-up');
    const volumeDownBtn = document.getElementById('volume-down');
    const connectBtn = document.getElementById('connect-btn');
    const talkBtn = document.getElementById('talk-btn');
    const currentChannelDisplay = document.getElementById('current-channel');
    const statusDisplay = document.getElementById('status');
    const usersListDisplay = document.getElementById('users-list');
    const ledIndicator = document.getElementById('led');
    const receiveAudio = document.getElementById('receive-audio');
    const connectSound = document.getElementById('connect-sound');
    const beepSound = document.getElementById('beep-sound');

    // Variables de estado
    let username = '';
    let currentChannel = 1;
    let isConnected = false;
    let isTalking = false;
    let volume = 5;
    let mediaRecorder;
    let audioChunks = [];
    let connectedUsers = {};
    
    // Simulación de conexión WebRTC (en una aplicación real usarías WebRTC o WebSockets)
    const simulatedUsers = {
        1: ['Carlos', 'María', 'Juan'],
        2: ['Ana', 'Pedro'],
        3: ['Sofía', 'Miguel'],
        4: ['Laura'],
        5: []
    };

    // Inicializar la interfaz
    function init() {
        updateChannelDisplay();
        updateVolumeLevel();
        
        // Cargar nombre de usuario guardado
        const savedUsername = localStorage.getItem('walkie-username');
        if (savedUsername) {
            username = savedUsername;
            usernameInput.value = username;
        }
    }

    // Actualizar el display del canal
    function updateChannelDisplay() {
        currentChannelDisplay.textContent = currentChannel;
        
        // Simular giro de la perilla del canal
        const knobIndicator = document.querySelector('.knob-indicator');
        const angle = (currentChannel - 1) * 72; // 360 / 5 canales = 72 grados por canal
        knobIndicator.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
    }

    // Actualizar nivel de volumen
    function updateVolumeLevel() {
        receiveAudio.volume = volume / 10;
    }

    // Actualizar lista de usuarios
    function updateUsersList() {
        if (!isConnected) {
            usersListDisplay.innerHTML = '';
            return;
        }
        
        let usersHTML = '';
        const channelUsers = simulatedUsers[currentChannel] || [];
        
        if (username && !channelUsers.includes(username)) {
            channelUsers.push(username);
        }
        
        channelUsers.forEach(user => {
            const isCurrentUser = user === username;
            usersHTML += `<div>${user} ${isCurrentUser ? '(tú)' : ''}</div>`;
        });
        
        usersListDisplay.innerHTML = usersHTML;
    }

    // Conectar/Desconectar
    function toggleConnection() {
        if (!username) {
            alert('Por favor, establece un nombre de usuario primero.');
            return;
        }
        
        isConnected = !isConnected;
        
        if (isConnected) {
            connectBtn.textContent = 'Desconectar';
            connectBtn.classList.add('disconnect');
            statusDisplay.textContent = `Conectado - Canal ${currentChannel}`;
            ledIndicator.classList.add('connected');
            talkBtn.disabled = false;
            
            // Reproducir sonido de conexión
            connectSound.volume = volume / 10;
            connectSound.play();
            
            // Simular recepción de mensajes
            startSimulatedMessages();
        } else {
            connectBtn.textContent = 'Conectar';
            connectBtn.classList.remove('disconnect');
            statusDisplay.textContent = 'Desconectado';
            ledIndicator.classList.remove('connected');
            ledIndicator.classList.remove('talking');
            talkBtn.disabled = true;
            
            // Detener simulación de mensajes
            stopSimulatedMessages();
        }
        
        updateUsersList();
    }

    // Iniciar grabación de audio
    async function startTalking() {
        if (!isConnected) return;
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            
            mediaRecorder.addEventListener('dataavailable', event => {
                audioChunks.push(event.data);
            });
            
            mediaRecorder.addEventListener('stop', () => {
                // En una aplicación real, aquí enviarías los datos de audio
                // a través de WebRTC o WebSockets
                console.log('Audio grabado y listo para enviar');
                
                // Reproducir beep de fin de transmisión
                beepSound.volume = volume / 10;
                beepSound.play();
            });
            
            // Iniciar grabación
            mediaRecorder.start();
            
            // Cambiar estado visual
            isTalking = true;
            ledIndicator.classList.add('talking');
            statusDisplay.textContent = 'Transmitiendo...';
            
            // Reproducir beep de inicio de transmisión
            beepSound.volume = volume / 10;
            beepSound.play();
            
        } catch (error) {
            console.error('Error al acceder al micrófono:', error);
            alert('No se pudo acceder al micrófono. Verifica los permisos.');
        }
    }

    // Detener grabación de audio
    function stopTalking() {
        if (!isConnected || !isTalking) return;
        
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            
            // Detener todas las pistas de audio
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
        
        // Cambiar estado visual
        isTalking = false;
        ledIndicator.classList.remove('talking');
        statusDisplay.textContent = `Conectado - Canal ${currentChannel}`;
    }

    // Simulación de mensajes entrantes
    let messageInterval;
    
    function startSimulatedMessages() {
        messageInterval = setInterval(() => {
            if (!isConnected || isTalking) return;
            
            const channelUsers = simulatedUsers[currentChannel] || [];
            if (channelUsers.length === 0) return;
            
            // Probabilidad de 20% de recibir un mensaje
            if (Math.random() < 0.2) {
                const randomUser = channelUsers[Math.floor(Math.random() * channelUsers.length)];
                if (randomUser !== username) {
                    receiveMessage(randomUser);
                }
            }
        }, 5000); // Comprobar cada 5 segundos
    }
    
    function stopSimulatedMessages() {
        clearInterval(messageInterval);
    }
    
    function receiveMessage(fromUser) {
        // Simular recepción de mensaje
        beepSound.volume = volume / 10;
        beepSound.play();
        
        statusDisplay.textContent = `Recibiendo de ${fromUser}...`;
        
        // Simular audio entrante con un sonido de estática
        simulateStaticSound();
        
        // Después de un tiempo aleatorio, volver al estado normal
        const duration = 1000 + Math.random() * 3000; // Entre 1 y 4 segundos
        setTimeout(() => {
            if (isConnected) {
                statusDisplay.textContent = `Conectado - Canal ${currentChannel}`;
            }
        }, duration);
    }
    
    function simulateStaticSound() {
        // Crear un contexto de audio
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Crear un nodo de ruido blanco
        const bufferSize = 2 * audioContext.sampleRate;
        const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        
        // Llenar el buffer con ruido blanco
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        
        // Crear un nodo de fuente y conectarlo
        const whiteNoise = audioContext.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        
        // Crear un nodo de ganancia para controlar el volumen
        const gainNode = audioContext.createGain();
        gainNode.gain.value = 0.1 * (volume / 10); // Ajustar según el volumen configurado
        
        // Conectar los nodos
        whiteNoise.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Reproducir el ruido por un tiempo aleatorio
        whiteNoise.start();
        setTimeout(() => {
            whiteNoise.stop();
        }, 1000 + Math.random() * 3000); // Entre 1 y 4 segundos
    }

    // Event Listeners
    setUsernameBtn.addEventListener('click', () => {
        const newUsername = usernameInput.value.trim();
        if (newUsername) {
            username = newUsername;
            localStorage.setItem('walkie-username', username);
            updateUsersList();
        }
    });

    channelUpBtn.addEventListener('click', () => {
        if (currentChannel < 5) {
            currentChannel++;
            updateChannelDisplay();
            if (isConnected) {
                statusDisplay.textContent = `Conectado - Canal ${currentChannel}`;
                updateUsersList();
            }
        }
    });

    channelDownBtn.addEventListener('click', () => {
        if (currentChannel > 1) {
            currentChannel--;
            updateChannelDisplay();
            if (isConnected) {
                statusDisplay.textContent = `Conectado - Canal ${currentChannel}`;
                updateUsersList();
            }
        }
    });

    volumeUpBtn.addEventListener('click', () => {
        if (volume < 10) {
            volume++;
            updateVolumeLevel();
        }
    });

    volumeDownBtn.addEventListener('click', () => {
        if (volume > 0) {
            volume--;
            updateVolumeLevel();
        }
    });

    connectBtn.addEventListener('click', toggleConnection);

    talkBtn.addEventListener('mousedown', startTalking);
    talkBtn.addEventListener('touchstart', startTalking);
    talkBtn.addEventListener('mouseup', stopTalking);
    talkBtn.addEventListener('touchend', stopTalking);
    talkBtn.addEventListener('mouseleave', stopTalking);

    // Inicializar la aplicación
    init();
});