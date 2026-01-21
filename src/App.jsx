import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Thermometer, 
  Droplets, 
  Wind, 
  Activity, 
  Home, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  CloudRain,
  RefreshCw,
  X,
  Wifi,
  WifiOff,
  Timer,
  Fan,
  AlertTriangle,
  Download,
  Bell,
  BellOff,
  BellRing,
  Settings,
  Save, 
  RotateCcw,
  ArrowRightLeft,
  Flame, 
  Minus,
  Plus,
  ListChecks,
  Power,
  Moon, 
  Sun,
  Snowflake,
  ChevronDown,
  ChevronUp,
  Palmtree,
  History,
  BrainCircuit,
  MoreVertical
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

// --- KONFIGURATION & UMGEBUNGSVARIABLEN ---

const getEnv = () => {
  try {
    return (import.meta && import.meta.env) ? import.meta.env : {};
  } catch (e) {
    return {};
  }
};
const env = getEnv();

const HA_URL = env.VITE_HA_URL || ""; 
const HA_TOKEN = env.VITE_HA_TOKEN || "";

const CLIMATE_MAPPING = {
  living: 'climate.thermostat_x_wohnzimmer', 
  bedroom: 'climate.thermostat_x_schlafzimmer',
  kids: 'climate.thermostat_x_kinderzimmer',
  play: 'climate.thermostat_x_spielzimmer',
  bath: 'climate.thermostat_x_bad',
  dining: 'climate.thermostat_x_esszimmer',
  kitchen: '', 
  basement: ''
};

const ROOM_CONNECTIONS = {
  living: ['dining', 'bath'], 
  kitchen: ['dining', 'bath'], 
  dining: ['living', 'kitchen', 'bath'],
  hallway: ['bedroom', 'play'], 
  bedroom: ['hallway'],
  kids: ['play'],
  play: ['kids', 'hallway'],
  bath: ['dining', 'living', 'kitchen'], 
  basement: [] 
};

// Räume, die durch die Klimaanlage im Bad gekühlt werden können
const AC_CONNECTED_ROOMS = ['bath', 'living', 'dining', 'kitchen'];

const SENSOR_MAPPING = {
  living: { 
    temp: 'sensor.smart_radiator_thermostat_x_temperatur', 
    humidity: 'sensor.smart_radiator_thermostat_x_luftfeuchtigkeit', 
    co2: 'sensor.indoor_co2', 
    window: 'binary_sensor.terrassentur_tur' 
  },
  kitchen: { 
    temp: 'sensor.indoor_aussentemperatur_temperature', 
    humidity: 'sensor.indoor_aussentemperatur_humidity', 
    window: 'binary_sensor.kuchenfenster_tur' 
  },
  bedroom: { 
    temp: 'sensor.smart_radiator_thermostat_x_temperatur_3', 
    humidity: 'sensor.smart_radiator_thermostat_x_luftfeuchtigkeit_3', 
    co2: 'sensor.unknown_70_ee_50_16_18_a0_kohlendioxid', 
    window: 'binary_sensor.schlafzimmer_fenster_tur' 
  },
  kids: { 
    temp: 'sensor.smart_radiator_thermostat_x_temperatur_5', 
    humidity: 'sensor.smart_radiator_thermostat_x_luftfeuchtigkeit_5',
    window: 'binary_sensor.kinderzimmer_fenster_tur'
  },
  play: { 
    temp: 'sensor.smart_radiator_thermostat_x_temperatur_4', 
    humidity: 'sensor.smart_radiator_thermostat_x_luftfeuchtigkeit_4'
  },
  bath: { 
    temp: 'sensor.smart_radiator_thermostat_x_temperatur_2', 
    humidity: 'sensor.smart_radiator_thermostat_x_luftfeuchtigkeit_2',
    window: 'binary_sensor.bad_fenster_tur'
  },
  dining: { 
    temp: 'sensor.thermostat_x_esszimmer_temperatur', 
    humidity: 'sensor.thermostat_x_esszimmer_luftfeuchtigkeit'
  },
  basement: { 
    temp: 'sensor.wetter_temperature_3', 
    humidity: 'sensor.wetter_humidity_3'
  },
  outside: {
    temp: 'sensor.hp2550a_pro_v1_6_7_outdoor_temperature',
    humidity: 'sensor.hp2550a_pro_v1_6_7_humidity'
  }
};

const DEFAULT_COMFORT_RANGES = {
  living: { label: 'Wohnbereich (Tag)', tempMin: 19.5, tempMax: 21.0, humMin: 40, humMax: 60 },
  sleeping: { label: 'Schlaf/Spiel (Tag)', tempMin: 18.5, tempMax: 20.0, humMin: 40, humMax: 60 },
  bathroom: { label: 'Badezimmer (Tag)', tempMin: 19.5, tempMax: 22.0, humMin: 40, humMax: 70 },
  storage: { label: 'Keller / Lager', tempMin: 10, tempMax: 25, humMin: 30, humMax: 65 },
  default: { label: 'Sonstige', tempMin: 18, tempMax: 22, humMin: 40, humMax: 60 }
};

const INITIAL_ROOMS = [
  { id: 'living', name: 'Wohnzimmer', type: 'living', hasCo2: true, hasWindow: true, hasVentilation: false, temp: 21.5, humidity: 45, co2: 650, windowOpen: false, lastWindowOpen: null, targetTemp: 20, hvacMode: 'heat' },
  { id: 'kitchen', name: 'Küche', type: 'living', hasCo2: false, hasWindow: true, hasVentilation: false, temp: 22.1, humidity: 68, co2: null, windowOpen: true, lastWindowOpen: null, targetTemp: null, hvacMode: 'off' }, 
  { id: 'bedroom', name: 'Schlafzimmer', type: 'sleeping', hasCo2: true, hasWindow: true, hasVentilation: true, temp: 18.0, humidity: 50, co2: 900, windowOpen: false, lastWindowOpen: null, targetTemp: 19, hvacMode: 'heat' },
  { id: 'kids', name: 'Kinderzimmer', type: 'sleeping', hasCo2: false, hasWindow: true, hasVentilation: true, temp: 20.5, humidity: 55, co2: null, windowOpen: false, lastWindowOpen: null, targetTemp: 19, hvacMode: 'heat' },
  { id: 'play', name: 'Spielzimmer', type: 'sleeping', hasCo2: false, hasWindow: false, hasVentilation: false, temp: 21.0, humidity: 48, co2: null, windowOpen: null, lastWindowOpen: null, targetTemp: 19, hvacMode: 'heat' },
  { id: 'bath', name: 'Bad', type: 'bathroom', hasCo2: false, hasWindow: true, hasVentilation: true, temp: 23.5, humidity: 82, co2: null, windowOpen: false, lastWindowOpen: null, targetTemp: 20, hvacMode: 'heat' },
  { id: 'dining', name: 'Esszimmer', type: 'living', hasCo2: false, hasWindow: false, hasVentilation: false, temp: 21.2, humidity: 46, co2: null, windowOpen: null, lastWindowOpen: null, targetTemp: 20, hvacMode: 'heat' },
  { id: 'basement', name: 'Keller', type: 'storage', hasCo2: false, hasWindow: true, hasVentilation: false, temp: 14.0, humidity: 60, co2: null, windowOpen: false, lastWindowOpen: null, targetTemp: null, hvacMode: 'off' },
];

const OUTSIDE_DATA = {
  temp: 12.5,
  humidity: 75,
  pressure: 1013,
  condition: 'Cloudy'
};

// --- HELPER FUNCTIONS ---

const calculateDewPoint = (T, RH) => {
  if (!T || !RH) return 0;
  const a = 17.27;
  const b = 237.7;
  const alpha = ((a * T) / (b + T)) + Math.log(RH / 100.0);
  return (b * alpha) / (a - alpha);
};

// Basistabelle für Lüftungsdauer (Fallback)
const getBaseVentilationTime = (outsideTemp) => {
  if (outsideTemp < 5) return 5;
  if (outsideTemp < 10) return 10;
  if (outsideTemp < 20) return 20;
  return 30;
};

const formatTimeAgo = (dateString) => {
  if (!dateString) return '';
  try {
    const diff = Date.now() - new Date(dateString).getTime();
    if (isNaN(diff)) return '';
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (minutes < 1) return 'gerade eben';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return '>1d';
  } catch (e) {
    return '';
  }
};

// --- SMART ANALYSIS ---

const analyzeRoom = (room, outside, settings, allRooms, extensions = {}, activeSession = null, smartLearning = {}) => {
  const hour = new Date().getHours();
  const isNight = hour >= 23 || hour < 7;
  
  let limits = settings[room.type] || settings.default;
  
  if (isNight && room.type !== 'storage') {
     limits = { ...limits, tempMin: 17.5, tempMax: 19.0 };
  }

  let score = 100;
  let issues = [];
  let recommendations = [];

  const neighbors = ROOM_CONNECTIONS[room.id] || [];
  
  const crossVentilationRoom = neighbors.find(nId => {
    const neighbor = allRooms.find(r => r.id === nId);
    return neighbor && neighbor.windowOpen;
  });
  
  const isCrossVentilating = room.windowOpen && !!crossVentilationRoom;
  
  // --- SMART TIMER LOGIC ---
  // 1. Basis-Wert aus Tabelle
  let baseTargetMin = getBaseVentilationTime(outside.temp);
  if (isCrossVentilating) baseTargetMin = Math.ceil(baseTargetMin / 2);

  // 2. Lernen (Historisch): Haben wir Erfahrungswerte?
  let learnedFactor = 1.0;
  const roomHistory = smartLearning[room.id];
  if (roomHistory && roomHistory.samples > 2) {
      // Wenn der Raum historisch schneller abkühlt (hohe Rate), verkürzen wir die Basiszeit
      // Normale Rate ca 0.1 Grad/Min. Wenn wir 0.2 haben, sind wir doppelt so schnell -> Faktor 0.5
      const avgRate = roomHistory.avgTempRate; 
      if (avgRate > 0.05) { // Nur wenn signifikante Änderung messbar war
         const standardRate = 0.1; // Annahme
         learnedFactor = Math.max(0.5, Math.min(1.5, standardRate / avgRate));
      }
  }
  
  let targetMin = Math.round(baseTargetMin * learnedFactor);

  // 3. Adaptiv (Live): Wie läuft es gerade?
  let isAdaptive = false;
  if (room.windowOpen && activeSession && activeSession.startTemp) {
      const diffMin = (Date.now() - activeSession.startTime) / 60000;
      
      // Nur adaptieren, wenn wir schon > 3 Min offen haben, um Rauschen zu vermeiden
      if (diffMin > 3) {
          const deltaTemp = activeSession.startTemp - room.temp; // Positive means cooling
          const currentRate = deltaTemp / diffMin; // Grad pro Minute

          // Ziel: TempMin erreichen (plus kleiner Puffer)
          // Wenn es zu warm ist, wollen wir auf limits.tempMax runter, oder limits.tempMin wenn wir kühlen wollen
          let targetTemp = room.temp;
          if (room.temp > limits.tempMax) targetTemp = limits.tempMax - 0.5;
          else if (room.humidity > limits.humMax) targetTemp = room.temp; // Bei Feuchte ist Temp egal, aber wir brauchen Zeitbezug

          // Wenn wir primär wegen Temperatur lüften (zu warm):
          if (deltaTemp > 0.2 && room.temp > limits.tempMax) {
              const remainingDrop = Math.max(0, room.temp - (limits.tempMax - 0.5));
              const predictedRemaining = remainingDrop / currentRate;
              
              // Wir mischen den vorhergesagten Wert mit dem Basiswert für Stabilität
              // Je länger wir offen haben, desto mehr vertrauen wir dem Live-Wert
              const trustFactor = Math.min(1.0, diffMin / 15); 
              
              // Die "bisher vergangene Zeit" muss natürlich zur "restlichen Zeit" addiert werden für die Gesamtdauer
              const totalPredicted = diffMin + predictedRemaining;
              
              targetMin = Math.round((targetMin * (1 - trustFactor)) + (totalPredicted * trustFactor));
              isAdaptive = true;
          }
      }
  }

  const sessionKey = `${room.id}-${room.lastWindowOpen}`;
  const extensionMin = extensions[sessionKey] || 0;
  const totalTargetMin = targetMin + extensionMin;
  
  const ventDurationText = `${totalTargetMin} Min`;

  // Temp Check
  if (room.temp < limits.tempMin) {
    score -= 20;
    issues.push({ type: 'temp', status: 'low', msg: 'Zu kalt' });
    
    if (!room.windowOpen) {
       if (room.targetTemp !== null && room.targetTemp !== undefined && room.targetTemp < limits.tempMin) {
           recommendations.push(`Thermostat zu niedrig (${room.targetTemp}°)`);
       } else {
           recommendations.push('Heizung prüfen');
       }
    }
  } else if (room.temp > limits.tempMax) {
    const isSignificantlyWarm = !isNight || (room.temp > limits.tempMax + 2.0);
    if (isSignificantlyWarm) {
        score -= isNight ? 10 : 20;
        issues.push({ type: 'temp', status: 'high', msg: isNight ? 'Warm (Nacht)' : 'Zu warm' });
        
        if (outside.temp >= room.temp - 0.5) { 
             recommendations.push('Abdunkeln (Draußen zu warm)');
        } else {
            recommendations.push(isNight ? 'Fenster auf zum Abkühlen' : 'Heizung runter / Lüften');
        }
    }
  }

  const dewPointInside = calculateDewPoint(room.temp, room.humidity);
  const dewPointOutside = calculateDewPoint(outside.temp, outside.humidity);

  if (room.humidity < limits.humMin) {
    score -= 15;
    issues.push({ type: 'hum', status: 'low', msg: 'Trockene Luft' });
    recommendations.push('Luftbefeuchter nutzen');
  } else if (room.humidity > limits.humMax) {
    const isVeryHigh = room.humidity > limits.humMax + 10; 
    score -= isVeryHigh ? 30 : 15;
    issues.push({ type: 'hum', status: 'high', msg: isVeryHigh ? 'Zu feucht' : 'Feucht' });
    
    if (dewPointOutside < dewPointInside) {
      if (room.windowOpen && room.lastWindowOpen) {
          const diffMs = Date.now() - new Date(room.lastWindowOpen).getTime();
          const openMin = diffMs / 60000;
          const remaining = Math.ceil(totalTargetMin - openMin);
          
          if (remaining > 0) {
             let msg = `Noch ${remaining} Min.`;
             if (isAdaptive) msg += " (Smart)";
             else if (learnedFactor !== 1.0) msg += " (Gelernt)";
             
             recommendations.push(msg);
             
             if (!isCrossVentilating) {
                const potentialCross = neighbors.find(nId => allRooms.find(r => r.id === nId)?.hasWindow && !allRooms.find(r => r.id === nId)?.windowOpen);
                if (potentialCross) recommendations.push(`Tipp: Durchzug mit ${allRooms.find(r => r.id === potentialCross)?.name}`);
             }
          } else {
             recommendations.push(`Fenster schließen.`);
          }
      } else {
          recommendations.push(`Lüften: ${ventDurationText}`);
      }
    } else {
      recommendations.push('Lüften ineffektiv (Draußen zu feucht)');
    }
  }

  if (room.hasCo2 && room.co2 > 1000) {
       const isCrit = room.co2 >= 1500;
       score -= isCrit ? 50 : 20;
       issues.push({ type: 'co2', status: isCrit ? 'crit' : 'warn', msg: 'CO2 hoch' });
       
       if (room.windowOpen && room.lastWindowOpen) {
          const diffMs = Date.now() - new Date(room.lastWindowOpen).getTime();
          const openMin = diffMs / 60000;
          const remaining = Math.ceil(totalTargetMin - openMin);
          recommendations.push(remaining > 0 ? `CO2: Noch ${remaining} Min.` : `Luft gut. Schließen.`);
       } else {
          recommendations.push(`Stoßlüften (${ventDurationText})`);
       }
  }

  if (room.windowOpen && room.temp < limits.tempMin && !recommendations.some(r => r.includes('Noch'))) {
    recommendations.push('Wärmeverlust!');
  }

  return {
    score: Math.max(0, score),
    issues,
    recommendations,
    dewPoint: dewPointInside.toFixed(1),
    isCrossVentilating,
    totalTargetMin,
    isNight,
    isAdaptive,
    learnedFactor
  };
};

// --- DATA HOOK ---

const useHomeAssistant = () => {
  const [rooms, setRooms] = useState(INITIAL_ROOMS);
  const [outside, setOutside] = useState(OUTSIDE_DATA);
  const [isDemoMode, setIsDemoMode] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [errorMessage, setErrorMessage] = useState('');
  
  const lastInteractionRef = useRef({});

  // Session Tracking für Smart Learning
  const [activeSessions, setActiveSessions] = useState(() => {
      const saved = localStorage.getItem('activeSessions');
      return saved ? JSON.parse(saved) : {};
  });

  const [smartLearning, setSmartLearning] = useState(() => {
      const saved = localStorage.getItem('smartLearning');
      return saved ? JSON.parse(saved) : {};
  });

  // Speichern bei Änderung
  useEffect(() => { localStorage.setItem('activeSessions', JSON.stringify(activeSessions)); }, [activeSessions]);
  useEffect(() => { localStorage.setItem('smartLearning', JSON.stringify(smartLearning)); }, [smartLearning]);

  const updateLearning = (roomId, session) => {
      const durationMin = (Date.now() - session.startTime) / 60000;
      if (durationMin < 5) return; // Zu kurz zum Lernen

      const startTemp = session.startTemp;
      const endTemp = rooms.find(r => r.id === roomId)?.temp || startTemp;
      
      const rate = (startTemp - endTemp) / durationMin; // Grad pro Minute
      
      if (rate <= 0) return; // Erwärmung oder keine Änderung ignorieren wir erst mal

      setSmartLearning(prev => {
          const currentStats = prev[roomId] || { samples: 0, avgTempRate: 0 };
          
          // Gleitender Durchschnitt (neu gewichtet mit 20%)
          const newAvg = currentStats.samples === 0 
              ? rate 
              : (currentStats.avgTempRate * 0.8) + (rate * 0.2);
          
          return {
              ...prev,
              [roomId]: {
                  samples: currentStats.samples + 1,
                  avgTempRate: newAvg,
                  lastUpdate: Date.now()
              }
          };
      });
  };

  const fetchData = async () => {
    if (!HA_URL || !HA_TOKEN) {
      setIsDemoMode(true);
      simulateDataChange();
      return;
    }

    try {
      setConnectionStatus('loading');
      const response = await fetch(`${HA_URL}/api/states`, {
        headers: { 'Authorization': `Bearer ${HA_TOKEN}`, 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      
      const states = await response.json();
      setConnectionStatus('connected');
      setIsDemoMode(false);
      setErrorMessage('');

      const getNum = (id) => {
        const e = states.find(s => s.entity_id === id);
        return e && !isNaN(e.state) ? parseFloat(e.state) : null;
      };

      if (SENSOR_MAPPING.outside) {
        setOutside({
          temp: getNum(SENSOR_MAPPING.outside.temp) || OUTSIDE_DATA.temp,
          humidity: getNum(SENSOR_MAPPING.outside.humidity) || OUTSIDE_DATA.humidity,
          pressure: 1013,
          condition: 'Loaded'
        });
      }

      setRooms(prevRooms => {
        const newRooms = prevRooms.map(room => {
          const map = SENSOR_MAPPING[room.id];
          const climateEntity = CLIMATE_MAPPING[room.id];
          
          if (!map) return room;

          const wSensor = states.find(s => s.entity_id === map.window);
          const wOpen = wSensor ? wSensor.state === 'on' : false;
          
          let lastOpen = room.lastWindowOpen;
          if (wOpen && wSensor) {
              if (room.windowOpen) lastOpen = room.lastWindowOpen;
              else lastOpen = wSensor.last_changed;
          }
          else if (!wOpen) lastOpen = null;

          // Temp fetching
          const currentTemp = getNum(map.temp) || room.temp;
          const currentHum = getNum(map.humidity) || room.humidity;

          // --- SESSION MANAGEMENT LOGIC ---
          const sessionKey = `${room.id}`;
          
          // Fenster ging AUF
          if (wOpen && !room.windowOpen) {
              setActiveSessions(prev => ({
                  ...prev,
                  [sessionKey]: {
                      startTime: Date.now(), // Wir nehmen unsere eigene Zeit, da präziser für Differenz
                      startTemp: currentTemp,
                      startHum: currentHum
                  }
              }));
          }
          // Fenster ging ZU
          else if (!wOpen && room.windowOpen) {
              const session = activeSessions[sessionKey];
              if (session) {
                  updateLearning(room.id, session); // LERNEN!
                  
                  // Session cleanup
                  setActiveSessions(prev => {
                      const next = {...prev};
                      delete next[sessionKey];
                      return next;
                  });
              }
          }

          let targetTemp = room.targetTemp;
          let hvacMode = room.hvacMode;
          
          if (climateEntity) {
             const e = states.find(s => s.entity_id === climateEntity);
             if (e) {
                 const lastInteract = lastInteractionRef.current[climateEntity] || 0;
                 if (Date.now() - lastInteract > 15000) {
                     targetTemp = e.attributes.temperature;
                     hvacMode = e.state;
                 }
             }
          }

          return {
            ...room,
            temp: currentTemp,
            humidity: currentHum,
            co2: map.co2 ? getNum(map.co2) : room.co2,
            windowOpen: wOpen,
            lastWindowOpen: lastOpen,
            targetTemp: targetTemp,
            hvacMode: hvacMode,
            climateEntity: climateEntity
          };
        });
        return newRooms;
      });

    } catch (error) {
      console.error("HA Fetch Error", error);
      setConnectionStatus('error');
      setErrorMessage('Verbindungsfehler');
    }
  };

  const setTemperature = async (entityId, newTemp) => {
    setRooms(prev => prev.map(r => r.climateEntity === entityId ? {...r, targetTemp: newTemp} : r));
    lastInteractionRef.current[entityId] = Date.now();

    if (isDemoMode) return;

    try {
      await fetch(`${HA_URL}/api/services/climate/set_temperature`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${HA_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_id: entityId, temperature: newTemp })
      });
    } catch (e) {
      console.error("Set Temp Error", e);
      alert("Fehler beim Senden an Home Assistant");
    }
  };

  const setHvacMode = async (entityId, newMode) => {
    setRooms(prev => prev.map(r => r.climateEntity === entityId ? {...r, hvacMode: newMode} : r));
    lastInteractionRef.current[entityId] = Date.now();

    if (isDemoMode) return;

    try {
      await fetch(`${HA_URL}/api/services/climate/set_hvac_mode`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${HA_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_id: entityId, hvac_mode: newMode })
      });
    } catch (e) {
      console.error("Set Mode Error", e);
      alert("Fehler beim Senden an Home Assistant");
    }
  };

  const simulateDataChange = () => {
    setRooms(prevRooms => prevRooms.map(room => {
      const tempChange = (Math.random() - 0.5) * 0.4;
      const humChange = Math.floor((Math.random() - 0.5) * 3);
      const co2Change = room.hasCo2 ? Math.floor((Math.random() - 0.5) * 50) : null;
      return {
        ...room,
        temp: Number((room.temp + tempChange).toFixed(1)),
        humidity: Math.max(30, Math.min(99, room.humidity + humChange)),
        co2: room.co2 ? Math.max(400, room.co2 + co2Change) : null
      };
    }));
  };

  const enableDemoMode = () => {
      setIsDemoMode(true);
      setConnectionStatus('connected');
      simulateDataChange();
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []); 

  return { rooms, outside, isDemoMode, connectionStatus, errorMessage, activeSessions, smartLearning, refresh: fetchData, enableDemoMode, setTemperature, setHvacMode };
};

// --- CHART COMPONENT ---
const HistoryChart = ({ type, data, color }) => {
  if (!data || data.length === 0) return <div className="h-40 flex items-center justify-center text-slate-500 text-xs">Keine Daten verfügbar</div>;
  
  return (
    <div className="h-40 w-full mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`color${type}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={color} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="time" 
            tick={{fontSize: 10, fill: '#64748b'}} 
            axisLine={false} 
            tickLine={false} 
            minTickGap={30} 
          />
          <YAxis 
            hide={true} 
            domain={['dataMin - 1', 'dataMax + 1']}
          />
          <Tooltip 
            contentStyle={{backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff'}}
            itemStyle={{color: color}}
            labelStyle={{color: '#94a3b8', fontSize: '10px'}}
          />
          <Area 
            type="monotone" 
            dataKey="value" 
            stroke={color} 
            fillOpacity={1} 
            fill={`url(#color${type})`} 
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// --- SETTINGS MODAL (Material 3 Style) ---
const SettingsModal = ({ settings, onSave, onClose }) => {
  const [localSettings, setLocalSettings] = useState(settings);

  const handleChange = (category, field, value) => {
    setLocalSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: Number(value)
      }
    }));
  };

  const handleReset = () => {
    if(window.confirm('Möchtest du wirklich alle Werte auf Standard zurücksetzen?')) {
      setLocalSettings(DEFAULT_COMFORT_RANGES);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 rounded-[28px] border border-slate-700 shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden">
        {/* M3 Headline */}
        <div className="p-6 pb-4 flex justify-between items-center bg-slate-900 z-10">
          <h2 className="text-2xl font-normal text-slate-100 flex items-center gap-2">
            Einstellungen
          </h2>
          <button onClick={onClose} className="p-3 rounded-full hover:bg-slate-800 text-slate-400 transition-colors">
            <X size={24}/>
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-8 custom-scrollbar">
          <div className="bg-blue-900/20 p-4 rounded-[16px] text-blue-200 border border-blue-900/30">
            <h3 className="text-sm font-medium mb-1 flex items-center gap-2"><Sun size={16}/> Tag-Einstellungen (07-23 Uhr)</h3>
            <p className="text-xs opacity-80">Nachts (23-07 Uhr) werden automatisch 18°C als Ziel verwendet.</p>
          </div>

          {Object.entries(localSettings).map(([key, config]) => (
            <div key={key} className="space-y-4">
              <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider px-1">
                {config.label || key}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {/* M3 Filled Text Field Replica */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 ml-3 flex items-center gap-1">Temperatur (°C)</label>
                  <div className="flex items-center gap-2 bg-slate-800 rounded-t-xl rounded-b-sm border-b border-slate-600 px-3 py-2">
                    <input type="number" value={config.tempMin} onChange={(e) => handleChange(key, 'tempMin', e.target.value)} className="w-full bg-transparent text-white text-center focus:outline-none"/>
                    <span className="text-slate-500">-</span>
                    <input type="number" value={config.tempMax} onChange={(e) => handleChange(key, 'tempMax', e.target.value)} className="w-full bg-transparent text-white text-center focus:outline-none"/>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 ml-3 flex items-center gap-1">Feuchtigkeit (%)</label>
                  <div className="flex items-center gap-2 bg-slate-800 rounded-t-xl rounded-b-sm border-b border-slate-600 px-3 py-2">
                    <input type="number" value={config.humMin} onChange={(e) => handleChange(key, 'humMin', e.target.value)} className="w-full bg-transparent text-white text-center focus:outline-none"/>
                    <span className="text-slate-500">-</span>
                    <input type="number" value={config.humMax} onChange={(e) => handleChange(key, 'humMax', e.target.value)} className="w-full bg-transparent text-white text-center focus:outline-none"/>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* M3 Actions Area */}
        <div className="p-6 pt-4 flex justify-end gap-2 bg-slate-900">
          <button onClick={handleReset} className="px-6 h-10 rounded-full text-slate-300 font-medium hover:bg-slate-800 hover:text-white transition-colors">
            Reset
          </button>
          <button onClick={() => onSave(localSettings)} className="px-6 h-10 rounded-full bg-blue-600 text-white font-medium hover:bg-blue-500 shadow-md transition-all active:scale-95">
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
};

// --- HEATING CONTROL MODAL (M3 Style) ---
const HeatingControlModal = ({ rooms, setTemperature, setHvacMode, onClose }) => {
  const heatedRooms = rooms.filter(r => r.climateEntity);

  const handleVacationMode = () => {
    if (confirm("Urlaubsmodus aktivieren? Alle Heizungen werden auf 18°C gestellt.")) {
       heatedRooms.forEach(room => {
          setTemperature(room.climateEntity, 18);
       });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 rounded-[28px] border border-slate-700 shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden">
        <div className="p-6 pb-2 flex justify-between items-center">
          <h2 className="text-2xl font-normal text-slate-100">Heizung</h2>
          <button onClick={onClose} className="p-3 rounded-full hover:bg-slate-800 text-slate-400 transition-colors"><X size={24}/></button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-4 custom-scrollbar">
          
          <button 
            onClick={handleVacationMode}
            className="w-full bg-indigo-900/30 border border-indigo-500/30 p-4 rounded-[16px] flex items-center justify-center gap-3 text-indigo-200 hover:bg-indigo-900/50 transition-colors"
          >
            <Palmtree size={20} />
            <span className="font-medium">Urlaubsmodus (Alle 18°C)</span>
          </button>

          {heatedRooms.length === 0 ? <div className="text-center text-slate-500 py-8">Keine steuerbaren Heizungen gefunden.</div> : heatedRooms.map(room => {
              const isOff = room.hvacMode === 'off';
              return (
              <div key={room.id} className="bg-slate-800 p-4 rounded-[20px] flex justify-between items-center">
                <div>
                  <div className="font-medium text-lg text-slate-100">{room.name}</div>
                  <div className="text-sm text-slate-400 mt-0.5">Ist: {room.temp}°C</div>
                </div>
                <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-2 bg-slate-900 p-1.5 rounded-full border border-slate-700 ${isOff ? 'opacity-50 pointer-events-none' : ''}`}>
                      <button onClick={() => setTemperature(room.climateEntity, (room.targetTemp || 20) - 1)} className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded-full text-slate-300 transition-colors"><Minus size={16}/></button>
                      <div className="w-10 text-center font-medium text-lg text-slate-200">{room.targetTemp ? room.targetTemp.toFixed(1) : '--'}</div>
                      <button onClick={() => setTemperature(room.climateEntity, (room.targetTemp || 20) + 1)} className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded-full text-slate-300 transition-colors"><Plus size={16}/></button>
                    </div>
                    <button 
                      onClick={() => setHvacMode(room.climateEntity, isOff ? 'heat' : 'off')}
                      className={`w-12 h-12 flex items-center justify-center rounded-full transition-colors ${isOff ? 'bg-slate-800 text-slate-400' : 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20'}`}
                    >
                      <Power size={20} />
                    </button>
                </div>
              </div>
            )})}
        </div>
        <div className="p-6 pt-2 bg-slate-900 flex justify-end">
           <button onClick={onClose} className="px-6 h-10 rounded-full bg-slate-800 text-slate-200 font-medium hover:bg-slate-700 transition-colors">Fertig</button>
        </div>
      </div>
    </div>
  );
};

// --- SUMMARY WIDGET VIEW ---
const SummaryWidgetView = ({ rooms, outside, settings, extensions, refresh }) => {
  const roomsWithActions = useMemo(() => {
    return rooms.map(room => {
      const analysis = analyzeRoom(room, outside, settings, rooms, extensions);
      return {
        ...room,
        recommendations: analysis.recommendations,
        score: analysis.score
      };
    }).filter(r => r.recommendations.length > 0);
  }, [rooms, outside, settings, extensions]);

  const avgScore = Math.round(rooms.reduce((acc, r) => acc + analyzeRoom(r, outside, settings, rooms, extensions).score, 0) / rooms.length);
  
  let statusText = "Gut";
  let statusColorClass = "bg-emerald-900 text-emerald-100";
  let iconColor = "text-emerald-200";
  
  if (avgScore < 80) { 
      statusText = "Okay"; 
      statusColorClass = "bg-yellow-900 text-yellow-100"; 
      iconColor = "text-yellow-200";
  }
  if (avgScore < 60) { 
      statusText = "Mies"; 
      statusColorClass = "bg-red-900 text-red-100"; 
      iconColor = "text-red-200";
  }

  return (
    <div className={`min-h-screen ${statusColorClass} p-3 flex flex-col items-center justify-center`} onClick={() => window.open('/', '_self')}>
       <div className="flex justify-between w-full items-center mb-2">
          <div className="flex items-center gap-2">
             <Activity size={24} className={iconColor}/>
             <span className="text-2xl font-normal">{statusText} ({avgScore})</span>
          </div>
          <button onClick={(e) => { e.stopPropagation(); refresh(); }} className="p-2 rounded-full bg-black/10 text-inherit hover:bg-black/20"><RefreshCw size={16}/></button>
       </div>
       
       <div className="w-full space-y-2 overflow-hidden flex-1">
          {roomsWithActions.length === 0 ? (
             <div className="text-center opacity-80 text-sm mt-4">
                Alles im grünen Bereich.
             </div>
          ) : (
             roomsWithActions.slice(0, 2).map((room, i) => (
                <div key={i} className="bg-black/10 p-3 rounded-[16px] text-xs">
                   <div className="font-medium mb-0.5 text-base">{room.name}</div>
                   <div className="opacity-90 truncate">{room.recommendations[0]}</div>
                </div>
             ))
          )}
          {roomsWithActions.length > 2 && (
             <div className="text-center text-[10px] opacity-60">
                + {roomsWithActions.length - 2} weitere...
             </div>
          )}
       </div>
    </div>
  );
};

// --- WIDGET VIEW ---
const WidgetView = ({ outside, rooms, refresh }) => {
  const avgTemp = (rooms.reduce((acc, r) => acc + r.temp, 0) / rooms.length).toFixed(1);
  const openWindows = rooms.filter(r => r.windowOpen).length;
  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 flex flex-col justify-center items-center">
        <div className="w-full max-w-xs space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Klima Status</span>
                <button onClick={refresh} className="p-2 rounded-full hover:bg-slate-800"><RefreshCw size={16}/></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="bg-slate-900 p-4 rounded-[24px] flex flex-col items-center border border-slate-800">
                  <CloudRain size={24} className="text-blue-400 mb-2"/><span className="text-3xl font-normal">{outside.temp}°</span><span className="text-xs text-slate-500 mt-1">Außen</span>
               </div>
               <div className="bg-slate-900 p-4 rounded-[24px] flex flex-col items-center border border-slate-800">
                  <Home size={24} className="text-indigo-400 mb-2"/><span className="text-3xl font-normal">{avgTemp}°</span><span className="text-xs text-slate-500 mt-1">Ø Innen</span>
               </div>
            </div>
            <div className={`p-4 rounded-[20px] flex items-center justify-center gap-2 text-sm font-medium border transition-colors cursor-pointer hover:opacity-90 ${openWindows > 0 ? 'bg-red-900/30 text-red-200 border-red-900/40' : 'bg-emerald-900/30 text-emerald-200 border-emerald-900/40'}`} onClick={() => window.open('/', '_self')}>
                {openWindows > 0 ? <Wind size={20}/> : <CheckCircle size={20}/>}{openWindows > 0 ? `${openWindows} Fenster offen!` : 'Alle Fenster zu'}
            </div>
        </div>
    </div>
  );
}

// --- WINDOW LIST MODAL ---
const WindowListModal = ({ rooms, onClose }) => {
  const openWindows = rooms.filter(r => r.windowOpen);
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 rounded-[28px] border border-slate-700 shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 p-6">
        <div className="flex justify-between items-center mb-6"><h3 className="text-2xl font-normal text-slate-100">Fensterstatus</h3><button onClick={onClose} className="p-3 rounded-full hover:bg-slate-800 text-slate-400"><X size={24}/></button></div>
        <div className="space-y-3">
          {openWindows.length > 0 ? (openWindows.map(room => (<div key={room.id} className="flex items-center gap-4 p-4 bg-slate-800 text-blue-100 rounded-[20px]"><div className="bg-blue-900/50 p-3 rounded-full text-blue-300"><Wind size={20}/></div><div><span className="font-medium text-lg block text-slate-100">{room.name}</span><span className="text-sm opacity-80">Fenster geöffnet</span></div></div>))) : (<div className="flex flex-col items-center py-8 text-emerald-200 bg-emerald-900/20 rounded-[24px] border border-emerald-900/30"><CheckCircle size={48} className="mb-4 opacity-80"/><span className="font-medium text-xl">Alles zu</span><span className="text-sm opacity-70 mt-1">Kein Fenster ist aktuell geöffnet</span></div>)}
        </div>
        <div className="mt-8 flex justify-end"><button onClick={onClose} className="px-6 h-10 rounded-full bg-slate-800 text-slate-200 font-medium hover:bg-slate-700 transition-colors">Schließen</button></div>
      </div>
    </div>
  );
};

// --- SUMMARY MODAL ---
const SummaryModal = ({ rooms, outside, settings, extensions, onClose }) => {
  const roomsWithActions = useMemo(() => {
    return rooms.map(room => {
      const analysis = analyzeRoom(room, outside, settings, rooms, extensions);
      return {
        ...room,
        recommendations: analysis.recommendations,
        issues: analysis.issues
      };
    }).filter(r => r.recommendations.length > 0);
  }, [rooms, outside, settings, extensions]);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 rounded-[28px] border border-slate-700 shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 pb-4 border-b border-slate-800 flex justify-between items-center">
          <h2 className="text-2xl font-normal text-slate-100 flex items-center gap-2">
            Analyse
          </h2>
          <button onClick={onClose} className="p-3 rounded-full hover:bg-slate-800 text-slate-400">
            <X size={24}/>
          </button>
        </div>
        <div className="p-6 overflow-y-auto space-y-4 custom-scrollbar">
          {roomsWithActions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-emerald-400">
               <CheckCircle size={64} className="mb-6 opacity-80"/>
               <span className="text-2xl font-normal">Alles Perfekt!</span>
               <span className="text-base opacity-70 mt-2">Keine Maßnahmen erforderlich.</span>
            </div>
          ) : (
            roomsWithActions.map(room => (
              <div key={room.id} className="bg-slate-800 p-5 rounded-[20px]">
                <div className="font-medium text-lg text-slate-100 mb-3 flex justify-between items-center">
                  {room.name}
                  {room.windowOpen && <span className="text-xs bg-blue-900/40 text-blue-200 px-3 py-1 rounded-full border border-blue-900/50 font-medium">Offen</span>}
                </div>
                <ul className="space-y-3">
                  {room.recommendations.map((rec, i) => (
                    <li key={i} className="text-sm text-slate-300 flex items-start gap-3 bg-slate-900/50 p-3 rounded-xl">
                       <span className="text-amber-500 mt-0.5">•</span>
                       {rec}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
        <div className="p-6 pt-2 flex justify-end">
           <button onClick={onClose} className="px-6 h-10 rounded-full bg-slate-800 text-slate-200 font-medium hover:bg-slate-700 transition-colors">Fertig</button>
        </div>
      </div>
    </div>
  );
};

// --- ROOM COMPONENTS (M3 Refined) ---

const M3StatCard = ({ icon: Icon, label, value, subValue, theme = 'primary', onClick }) => {
  // M3 Tonal Palette mapping approximation
  const themes = {
    // Surface Container High / On Surface
    primary: 'bg-slate-800 text-slate-200', 
    // Secondary Container / On Secondary Container
    secondary: 'bg-slate-800 text-indigo-200',
    // Tertiary Container / On Tertiary Container
    tertiary: 'bg-slate-800 text-orange-200',
    neutral: 'bg-slate-800 text-slate-300'
  };
  
  return (
    <div 
      onClick={onClick}
      className={`p-5 rounded-[24px] flex flex-col justify-between h-32 ${themes[theme]} ${onClick ? 'cursor-pointer hover:bg-slate-700 transition-colors active:scale-[0.98]' : ''}`}
    >
      <div className="flex justify-between items-start">
        <Icon size={24} className="opacity-90"/>
        <span className="text-3xl font-normal">{value}</span>
      </div>
      <div>
        <div className="text-xs font-medium opacity-80 uppercase tracking-wider">{label}</div>
        <div className="text-xs opacity-60 mt-1">{subValue}</div>
      </div>
    </div>
  );
};

const RoomCardM3 = ({ room, outsideData, settings, allRooms, extensions, activeSession, smartLearning, onClick }) => {
  const analysis = useMemo(() => analyzeRoom(room, outsideData, settings, allRooms, extensions, activeSession, smartLearning), [room, outsideData, settings, allRooms, extensions, activeSession, smartLearning]);
  
  // M3 State Layer Colors
  // Default: Surface Container
  let containerClass = "bg-slate-800 hover:bg-slate-700 text-slate-200";
  let scoreBadgeClass = "bg-slate-700 text-slate-300";
  let iconBgClass = "bg-slate-900 text-slate-400";
  
  if (analysis.score < 80) { 
    // Warning: Surface Container Variant (Yellow-ish tint)
    containerClass = "bg-yellow-900/10 hover:bg-yellow-900/20 text-yellow-100 border border-yellow-900/30";
    scoreBadgeClass = "bg-yellow-900/30 text-yellow-200"; 
    iconBgClass = "bg-yellow-900/20 text-yellow-200";
  }
  if (analysis.score < 60) { 
    // Error: Error Container
    containerClass = "bg-red-900/10 hover:bg-red-900/20 text-red-100 border border-red-900/30"; 
    scoreBadgeClass = "bg-red-900/30 text-red-200";
    iconBgClass = "bg-red-900/20 text-red-200";
  }
  if (room.windowOpen) {
     // Active State: Primary Containerish
     // Override only if not bad
     if (analysis.score >= 80) {
        containerClass = "bg-blue-900/20 hover:bg-blue-900/30 text-blue-100 border border-blue-900/30";
        iconBgClass = "bg-blue-900/30 text-blue-300";
     }
  }

  const countdownMsg = analysis.recommendations.find(r => r.includes('Noch') && r.includes('Min'));

  return (
    <div 
      onClick={onClick}
      className={`group relative p-5 rounded-[24px] transition-all cursor-pointer active:scale-[0.98] ${containerClass}`}
    >
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3 overflow-hidden">
           <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${iconBgClass}`}>
             <Home size={20} />
           </div>
           <div className="min-w-0">
              <h3 className="font-medium text-lg leading-tight truncate">{room.name}</h3>
              {room.windowOpen && (
                 <p className="text-xs font-medium opacity-80 flex items-center gap-1 mt-0.5">
                   Offen {formatTimeAgo(room.lastWindowOpen)}
                 </p>
              )}
           </div>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 ${scoreBadgeClass}`}>
          {analysis.score}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-black/20 p-3 rounded-[16px]">
           <div className="text-xs opacity-60 mb-1">Temp</div>
           <div className="text-xl font-normal">{room.temp ? room.temp.toFixed(1) : '-'}°</div>
        </div>
        <div className="bg-black/20 p-3 rounded-[16px]">
           <div className="text-xs opacity-60 mb-1">Feuchte</div>
           <div className={`text-xl font-normal ${analysis.issues.some(i => i.type === 'hum') ? 'text-red-300' : ''}`}>
             {room.humidity || '-'}%
           </div>
        </div>
      </div>

      {analysis.recommendations.length > 0 && (
         <div className={`mt-1 flex items-center gap-3 text-xs p-3 rounded-[16px] ${countdownMsg ? 'bg-blue-400/10 text-blue-200' : 'bg-black/20 opacity-80'}`}>
            {analysis.isCrossVentilating && <ArrowRightLeft size={16} className="shrink-0 text-blue-300"/>}
            {countdownMsg && !analysis.isCrossVentilating && analysis.isAdaptive && <BrainCircuit size={16} className="shrink-0 text-pink-300"/>}
            {countdownMsg && !analysis.isCrossVentilating && !analysis.isAdaptive && <Timer size={16} className="shrink-0"/>}
            
            {!countdownMsg && !analysis.isCrossVentilating && analysis.recommendations.some(r => r.includes('Klima') || r.includes('AC')) && <Snowflake size={16} className="shrink-0 text-blue-300"/>}
            {!countdownMsg && !analysis.isCrossVentilating && !analysis.recommendations.some(r => r.includes('Klima') || r.includes('AC')) && <AlertCircle size={16} className="shrink-0 text-amber-400"/>}
            <span className="line-clamp-1 font-medium">{countdownMsg || analysis.recommendations[0]}</span>
         </div>
      )}
    </div>
  );
};

const M3Modal = ({ room, outsideData, settings, allRooms, extensions, activeSession, smartLearning, onClose }) => {
  if (!room) return null;
  const analysis = useMemo(() => analyzeRoom(room, outsideData, settings, allRooms, extensions, activeSession, smartLearning), [room, outsideData, settings, allRooms, extensions, activeSession, smartLearning]);
  const limits = settings[room.type] || settings.default;
  
  // History State
  const [activeChart, setActiveChart] = useState(null); // 'temp' or 'humidity'
  const [historyData, setHistoryData] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const fetchHistory = async (entityId) => {
    if (!HA_URL || !HA_TOKEN || !entityId) return;
    
    setIsLoadingHistory(true);
    setHistoryData([]);
    
    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000); // 24h
      
      const url = `${HA_URL}/api/history/period/${startTime.toISOString()}?filter_entity_id=${entityId}&end_time=${endTime.toISOString()}`;
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${HA_TOKEN}`, 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) throw new Error('History fetch failed');
      
      const data = await response.json();
      
      if (data && data.length > 0) {
        const formattedData = data[0].map(entry => ({
          time: new Date(entry.last_updated).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
          value: parseFloat(entry.state)
        })).filter(d => !isNaN(d.value));
        
        // Downsample data for performance (take every n-th point)
        const downsampled = formattedData.filter((_, index) => index % 10 === 0);
        setHistoryData(downsampled);
      }
    } catch (e) {
      console.error("History fetch error", e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const [windowHistory, setWindowHistory] = useState([]);
  const [isLoadingWindowHistory, setIsLoadingWindowHistory] = useState(false);
  
  const fetchWindowHistory = async (entityId) => {
      if (!HA_URL || !HA_TOKEN || !entityId) return;
      setIsLoadingWindowHistory(true);
      try {
          const endTime = new Date();
          const startTime = new Date(endTime.getTime() - 48 * 60 * 60 * 1000); // Last 48h
          const url = `${HA_URL}/api/history/period/${startTime.toISOString()}?filter_entity_id=${entityId}&end_time=${endTime.toISOString()}`;
          const response = await fetch(url, {
             headers: { 'Authorization': `Bearer ${HA_TOKEN}`, 'Content-Type': 'application/json' },
          });
          if (!response.ok) throw new Error('History fetch failed');
          const data = await response.json();
          if(data && data.length > 0) {
              const events = data[0];
              const historyList = [];
              let openStart = null;
  
              for(let i=0; i<events.length; i++) {
                  const evt = events[i];
                  if(evt.state === 'on' && !openStart) {
                      openStart = new Date(evt.last_changed);
                  } else if (evt.state === 'off' && openStart) {
                      const end = new Date(evt.last_changed);
                      const durationMin = Math.round((end - openStart) / 60000);
                      if (durationMin > 0) {
                           historyList.push({
                               start: openStart,
                               end: end,
                               duration: durationMin
                           });
                      }
                      openStart = null;
                  }
              }
              // Add current open session if exists
              if(openStart) {
                   const now = new Date();
                   const durationMin = Math.round((now - openStart) / 60000);
                   historyList.push({
                        start: openStart,
                        end: null, // Still open
                        duration: durationMin
                   });
              }
              // Sort newest first
              setWindowHistory(historyList.reverse().slice(0, 5));
          }
      } catch(e) {
          console.error("Window history error", e);
      } finally {
          setIsLoadingWindowHistory(false);
      }
  };
  
  useEffect(() => {
      // Wenn das Fenster geöffnet ist oder ein Fenstersensor definiert ist
      const map = SENSOR_MAPPING[room.id];
      if(map && map.window) {
          fetchWindowHistory(map.window);
      }
  }, [room.id]);


  const toggleChart = (type) => {
    if (activeChart === type) {
      setActiveChart(null);
    } else {
      setActiveChart(type);
      const map = SENSOR_MAPPING[room.id];
      if (map) {
        let entityId;
        if (type === 'temp') entityId = map.temp;
        if (type === 'humidity') entityId = map.humidity;
        if (type === 'co2') entityId = map.co2;
        
        fetchHistory(entityId);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 rounded-[28px] border border-slate-700 shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        {/* M3 Modal Header */}
        <div className="p-6 pb-2 flex justify-between items-start">
           <div>
             <h2 className="text-2xl font-normal text-slate-100">{room.name}</h2>
             <p className="text-slate-400 text-sm mt-1">Details & Analyse {analysis.isNight && '(Nachtmodus)'}</p>
           </div>
           <button onClick={onClose} className="p-3 rounded-full hover:bg-slate-800 text-slate-400 transition-colors"><X size={24}/></button>
        </div>
        
        <div className="p-6 pt-4 overflow-y-auto custom-scrollbar">
          
          <div className={`mb-6 p-5 rounded-[24px] flex items-center gap-5 ${analysis.score >= 80 ? 'bg-emerald-900/20 text-emerald-200 border border-emerald-900/30' : analysis.score >= 60 ? 'bg-yellow-900/20 text-yellow-200 border border-yellow-900/30' : 'bg-red-900/20 text-red-200 border border-red-900/30'}`}>
             <div className="text-5xl font-normal">{analysis.score}</div>
             <div className="text-sm opacity-90 border-l border-current pl-5 leading-tight font-medium">Klima-<br/>Score</div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
             {/* Temperatur Box - Klickbar */}
             <div 
               onClick={() => toggleChart('temp')}
               className={`bg-slate-800 p-5 rounded-[24px] transition-all cursor-pointer border ${activeChart === 'temp' ? 'border-orange-500 bg-slate-800 ring-1 ring-orange-500/20' : 'border-slate-800 hover:bg-slate-700'}`}
             >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-slate-400 text-xs font-medium"><Thermometer size={16}/> Temperatur</div>
                  {activeChart === 'temp' ? <ChevronUp size={16} className="text-orange-500"/> : <ChevronDown size={16} className="text-slate-500"/>}
                </div>
                <div className="text-3xl font-normal text-white">{room.temp}°C</div>
                <div className="text-xs text-slate-500 mt-2">Ziel: {limits.tempMin}-{limits.tempMax}°</div>
             </div>
             
             {/* Feuchtigkeit Box - Klickbar */}
             <div 
               onClick={() => toggleChart('humidity')}
               className={`bg-slate-800 p-5 rounded-[24px] transition-all cursor-pointer border ${activeChart === 'humidity' ? 'border-blue-500 bg-slate-800 ring-1 ring-blue-500/20' : 'border-slate-800 hover:bg-slate-700'}`}
             >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-slate-400 text-xs font-medium"><Droplets size={16}/> Feuchte</div>
                  {activeChart === 'humidity' ? <ChevronUp size={16} className="text-blue-500"/> : <ChevronDown size={16} className="text-slate-500"/>}
                </div>
                <div className="text-3xl font-normal text-white">{room.humidity}%</div>
                <div className="text-xs text-slate-500 mt-2">Ziel: {limits.humMin}-{limits.humMax}%</div>
             </div>
          </div>

          {/* DIAGRAMM ANZEIGE für Temp/Feuchte */}
          {(activeChart === 'temp' || activeChart === 'humidity') && (
            <div className="mb-6 animate-in slide-in-from-top-4 fade-in duration-300">
               <div className="bg-slate-900 p-5 rounded-[24px] border border-slate-800">
                  <div className="text-xs font-bold text-slate-500 mb-4 uppercase tracking-wider flex justify-between">
                     Verlauf (24h)
                     {isLoadingHistory && <RefreshCw size={12} className="animate-spin"/>}
                  </div>
                  {isLoadingHistory ? (
                     <div className="h-40 flex items-center justify-center text-slate-600 text-xs">Lade Daten...</div>
                  ) : (
                     <HistoryChart 
                        type={activeChart} 
                        data={historyData} 
                        color={activeChart === 'temp' ? '#f97316' : '#3b82f6'} 
                     />
                  )}
               </div>
            </div>
          )}

          {/* CO2 Section */}
          {room.hasCo2 && (
            <div 
              onClick={() => toggleChart('co2')}
              className={`mb-6 bg-slate-800 p-5 rounded-[24px] transition-all cursor-pointer flex justify-between items-center border ${activeChart === 'co2' ? 'border-purple-500 bg-slate-800 ring-1 ring-purple-500/20' : 'border-slate-800 hover:bg-slate-700'}`}
            >
              <div>
                <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1">
                   <Wind size={16}/> CO2 Belastung
                   {activeChart === 'co2' ? <ChevronUp size={16} className="text-purple-500"/> : <ChevronDown size={16} className="text-slate-500"/>}
                </div>
                <div className="text-2xl font-normal text-white">{room.co2} ppm</div>
              </div>
              <div className={`px-4 py-2 rounded-full text-xs font-bold ${room.co2 < 1000 ? 'bg-emerald-900/30 text-emerald-300' : 'bg-red-900/30 text-red-300'}`}>
                {room.co2 < 1000 ? 'Gut' : 'Schlecht'}
              </div>
            </div>
          )}

          {/* DIAGRAMM ANZEIGE für CO2 */}
          {activeChart === 'co2' && (
            <div className="mb-6 animate-in slide-in-from-top-4 fade-in duration-300">
               <div className="bg-slate-900 p-5 rounded-[24px] border border-slate-800">
                  <div className="text-xs font-bold text-slate-500 mb-4 uppercase tracking-wider flex justify-between">
                     CO2 Verlauf (24h)
                     {isLoadingHistory && <RefreshCw size={12} className="animate-spin"/>}
                  </div>
                  {isLoadingHistory ? (
                     <div className="h-40 flex items-center justify-center text-slate-600 text-xs">Lade Daten...</div>
                  ) : (
                     <HistoryChart 
                        type={activeChart} 
                        data={historyData} 
                        color={'#8b5cf6'} 
                     />
                  )}
               </div>
            </div>
          )}

          <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3 px-1">Empfehlungen</h3>
          <div className="space-y-3">
             {analysis.recommendations.length > 0 ? analysis.recommendations.map((rec, i) => (
                <div key={i} className={`flex gap-4 p-4 rounded-[20px] items-center ${rec.includes('Noch') ? 'bg-blue-900/20 text-blue-100' : 'bg-slate-800 text-slate-200'}`}>
                    <div className="opacity-80">
                        {rec.includes('Smart') ? <BrainCircuit size={20} className="text-pink-300"/> :
                         rec.includes('Klima') || rec.includes('AC') ? <Snowflake size={20}/> : 
                         rec.includes('Querlüften') ? <ArrowRightLeft size={20}/> : 
                         rec.includes('Noch') ? <Timer size={20}/> : <Activity size={20}/>}
                    </div>
                    <div className="text-sm font-medium">{rec}</div>
                </div>
             )) : (<div className="flex gap-4 p-5 rounded-[20px] bg-emerald-900/20 text-emerald-200 items-center"><CheckCircle size={24} /><span className="font-medium text-base">Perfektes Klima.</span></div>)}
          </div>
           
           {/* Fenster Status Section */}
           <div className="mt-8 pt-6 border-t border-slate-800 space-y-4">
                  <div className="flex flex-col gap-3">
                      <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-400 font-medium">Fenster</span>
                          <div className="flex items-center gap-2">
                             {room.windowOpen ? (
                                <span className="flex items-center gap-2 text-blue-200 font-medium px-4 py-1.5 bg-blue-900/30 rounded-full">
                                   <Wind size={14}/> Offen
                                </span>
                             ) : (
                                <span className="text-slate-500">Geschlossen</span>
                             )}
                          </div>
                      </div>
                      
                      {/* Window History Log - Nur anzeigen wenn Sensor definiert ist */}
                      {SENSOR_MAPPING[room.id]?.window && (
                          <div className="bg-slate-900 rounded-[20px] p-4 mt-2">
                             <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-3 uppercase tracking-wider">
                                <History size={14}/> Lüftungshistorie
                             </div>
                             {isLoadingWindowHistory ? (
                                <div className="text-xs text-slate-600 text-center py-2">Lade...</div>
                             ) : windowHistory.length > 0 ? (
                                <div className="space-y-3">
                                   {windowHistory.map((entry, idx) => (
                                      <div key={idx} className="flex justify-between items-center text-xs text-slate-300">
                                         <span>
                                            {entry.end ? new Date(entry.start).toLocaleDateString('de-DE', {weekday: 'short'}) + ', ' : ''}
                                            {new Date(entry.start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                         </span>
                                         <span className={`${!entry.end ? 'text-blue-300 font-medium' : 'opacity-60'}`}>
                                            {entry.end ? `${entry.duration} Min` : 'Offen'}
                                         </span>
                                      </div>
                                   ))}
                                </div>
                             ) : (
                                <div className="text-xs text-slate-600 text-center py-2">Keine Daten (48h)</div>
                             )}
                          </div>
                      )}
                  </div>
           </div>

        </div>
      </div>
    </div>
  );
};

// --- APP ---

export default function App() {
  const [rooms, setRooms] = useState(INITIAL_ROOMS);
  const [outside, setOutside] = useState(OUTSIDE_DATA);
  const [isDemoMode, setIsDemoMode] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [errorMessage, setErrorMessage] = useState('');
  
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showWindowModal, setShowWindowModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHeatingModal, setShowHeatingModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false); 
  const [installPrompt, setInstallPrompt] = useState(null);
  
  const [notifiedSessions, setNotifiedSessions] = useState(new Set());
  const [notifyPerm, setNotifyPerm] = useState('default');
  const [timerExtensions, setTimerExtensions] = useState({});

  // Speichert den letzten Benachrichtigungstext pro Raum, um Spam zu vermeiden
  const lastNotificationMap = useRef({});

  const [comfortSettings, setComfortSettings] = useState(() => {
    const saved = localStorage.getItem('comfortSettings');
    return saved ? JSON.parse(saved) : DEFAULT_COMFORT_RANGES;
  });

  const handleSaveSettings = (newSettings) => {
    setComfortSettings(newSettings);
    localStorage.setItem('comfortSettings', JSON.stringify(newSettings));
    setShowSettings(false);
  };

  const isWidgetMode = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    if (view === 'widget') return 'widget';
    if (view === 'widget-summary') return 'widget-summary';
    return null;
  }, []);

  const { refresh, enableDemoMode, setTemperature, setHvacMode, activeSessions, smartLearning } = useHomeAssistant();

  // Data fetching hook usage merged here
  useEffect(() => {
    const fetchData = async () => {
      // Logic now moved inside useHomeAssistant, this effect purely for polling trigger
      // BUT we need the local state sync, which useHomeAssistant handles internally now
      refresh();
    };
    
    // Initial fetch handled by hook, interval handled by hook
    // We just need to sync the rooms state from the hook to the App state for rendering
    // Actually, useHomeAssistant returns 'rooms' state directly.
    // Refactoring: We should consume the hook's state directly instead of duplicating it.
    
    // HOWEVER, to keep the existing structure working with minimal refactor, we will sync:
  }, []);

  // Sync Hook State to App State
  // This is a bit redundant but keeps the component structure intact
  const hookData = useHomeAssistant();
  useEffect(() => {
      setRooms(hookData.rooms);
      setOutside(hookData.outside);
      setConnectionStatus(hookData.connectionStatus);
      setIsDemoMode(hookData.isDemoMode);
      setErrorMessage(hookData.errorMessage);
  }, [hookData.rooms, hookData.outside, hookData.connectionStatus, hookData.isDemoMode, hookData.errorMessage]);


  useEffect(() => {
    if ('Notification' in window) {
      setNotifyPerm(Notification.permission);
    }
  }, []);

  const sendNotification = (title, options) => {
    if (Notification.permission !== 'granted') return;
    
    const defaults = {
        vibrate: [], 
        requireInteraction: true,  
        icon: '/pwa-192x192.png',
        renotify: false 
    };
    
    const finalOptions = { ...defaults, ...options };

    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title, finalOptions);
        });
      } else {
        const safeOptions = { ...finalOptions };
        delete safeOptions.vibrate; 
        new Notification(title, safeOptions);
      }
    } catch (e) {
      console.error('Notify failed', e);
    }
  };

  useEffect(() => {
    if (notifyPerm !== 'granted') return;

    rooms.forEach(room => {
      const limits = comfortSettings[room.type] || comfortSettings.default;
      const analysis = analyzeRoom(room, outside, comfortSettings, rooms, timerExtensions, activeSessions[room.id], smartLearning); 

      // --- 1. Kritische Luftqualität ---
      if (analysis.score <= 50) { 
          const datePart = new Date().toLocaleDateString();
          const hourPart = new Date().getHours();
          const badAirKey = `${room.id}-critical-${datePart}-${hourPart}`;

          if (!notifiedSessions.has(badAirKey)) {
             const mainIssue = analysis.issues[0]?.msg || 'Werte kritisch';
             const recommendation = analysis.recommendations[0] || 'Bitte prüfen';
             
             sendNotification(`Kritische Luft: ${room.name}`, {
                body: `${mainIssue}. ${recommendation}`,
                tag: badAirKey,
                icon: '/pwa-192x192.png',
                vibrate: [200, 100, 200]
             });
             setNotifiedSessions(prev => new Set(prev).add(badAirKey));
          }
      }

      // --- 2. Fenster-Offen Logik ---
      if (room.windowOpen && room.lastWindowOpen) {
          // Use the calculated total target min from analysis (which includes smart logic)
          const totalTargetMin = analysis.totalTargetMin;
          
          const diffMs = Date.now() - new Date(room.lastWindowOpen).getTime();
          const openMin = diffMs / 60000;
          const remaining = Math.ceil(totalTargetMin - openMin);
          
          // AUTO-EXTENSION
          if (remaining <= 0) {
              const sessionBase = `${room.id}-${room.lastWindowOpen}`;
              const hasIssues = analysis.issues.some(i => (i.type === 'hum' && i.status === 'high') || i.type === 'co2');
              const extensionMin = timerExtensions[sessionBase] || 0;
              
              if (hasIssues && extensionMin < 30) {
                  const newExtension = extensionMin + 5;
                  const extKey = `${sessionBase}-ext-${newExtension}`;
                  
                  if (!notifiedSessions.has(extKey)) {
                      setTimerExtensions(prev => ({...prev, [sessionBase]: newExtension}));
                      setNotifiedSessions(prev => new Set(prev).add(extKey));
                      return; 
                  }
              }
          }

          // --- STATUS TEXT ---
          let title = `Lüften: ${room.name}`;
          let statusIcon = "⏳";
          let statusText = `Noch ${Math.max(0, remaining)} Min.`;
          let reasonText = "";
          
          if (analysis.isAdaptive) statusText += " (Smart)";
          
          const humIssue = analysis.issues.find(i => i.type === 'hum');
          const co2Issue = analysis.issues.find(i => i.type === 'co2');
          
          if (co2Issue) reasonText += `CO2 hoch (${room.co2}) `;
          if (humIssue) reasonText += `Feuchte hoch (${room.humidity}%) `;
          if (!co2Issue && !humIssue) reasonText = "Luftqualität gut ✅";

          let isCold = false;
          if (room.temp < limits.tempMin) {
              isCold = true;
              title = `ACHTUNG KÄLTE: ${room.name}`;
              statusIcon = "❄️";
              statusText = "Sofort schließen!";
              reasonText = `${room.temp}°C (Zu kalt!)`;
          } else if (remaining <= 0) {
              title = `Fenster schließen: ${room.name}`;
              statusIcon = "✅";
              statusText = "Zeit abgelaufen";
          }

          const body = `${statusIcon} ${statusText}\n🌡️ ${room.temp}°C | ${reasonText}`;

          // --- SENDEN ---
          if (lastNotificationMap.current[room.id] !== body) {
              let vibrate = []; 
              let renotify = false;

              if (isCold) {
                  vibrate = [500, 200, 500];
                  renotify = true; 
              } else if (remaining <= 0) {
                  vibrate = [200, 100, 200];
                  renotify = true; 
              }

              sendNotification(title, {
                  body: body,
                  tag: `${room.id}-${room.lastWindowOpen}`, 
                  vibrate: vibrate,
                  renotify: renotify
              });

              lastNotificationMap.current[room.id] = body;
          }
      }
    });
  }, [rooms, outside, notifiedSessions, notifyPerm, comfortSettings, timerExtensions, activeSessions, smartLearning]);

  // Install Prompt
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const res = await installPrompt.userChoice;
    if (res.outcome === 'accepted') setInstallPrompt(null);
  };

  const requestNotifications = async () => {
    if (!('Notification' in window)) return;
    const res = await Notification.requestPermission();
    setNotifyPerm(res);
    if (res === 'granted') sendNotification('Test', { body: 'Benachrichtigungen aktiv' });
  };

  const testNotification = () => {
    sendNotification('Test-Alarm', { body: 'Dies ist eine Test-Benachrichtigung.' });
  };

  if (isWidgetMode === 'widget') {
    return <WidgetView outside={outside} rooms={rooms} refresh={hookData.refresh} />;
  }
  
  if (isWidgetMode === 'widget-summary') {
     return <SummaryWidgetView rooms={rooms} outside={outside} settings={comfortSettings} extensions={timerExtensions} refresh={hookData.refresh} />;
  }

  const avgTemp = (rooms.reduce((acc, r) => acc + r.temp, 0) / rooms.length).toFixed(1);
  const openWindows = rooms.filter(r => r.windowOpen).length;
  // Use hookData smartLearning here for analysis in render
  const avgScore = Math.round(rooms.reduce((acc, r) => acc + analyzeRoom(r, outside, comfortSettings, rooms, timerExtensions, hookData.activeSessions[r.id], hookData.smartLearning).score, 0) / rooms.length);
  let statusText = "Gut";
  let statusColorClass = "bg-emerald-900/20 text-emerald-100 border border-emerald-900/30";
  let iconColor = "text-emerald-200";

  if (avgScore < 80) { 
    statusText = "Okay"; 
    statusColorClass = "bg-yellow-900/20 text-yellow-100 border border-yellow-900/30";
    iconColor = "text-yellow-200"; 
  }
  if (avgScore < 60) { 
    statusText = "Mies"; 
    statusColorClass = "bg-red-900/20 text-red-100 border border-red-900/30";
    iconColor = "text-red-200"; 
  }

  const hour = new Date().getHours();
  const isNight = hour >= 23 || hour < 7;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 safe-area-inset-bottom">
      <div className="max-w-7xl mx-auto pb-8">
        
        {/* HEADER */}
        <header className="mb-6 flex flex-col gap-5">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-normal text-white tracking-tight">Raumklima</h1>
              <div className="flex items-center gap-3 mt-2 text-sm text-slate-400 font-medium">
                 {isDemoMode ? (
                   <span className="flex items-center gap-1.5 bg-slate-900 px-3 py-1 rounded-full text-slate-300"><WifiOff size={14}/> Demo</span>
                 ) : (
                   <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${connectionStatus === 'error' ? 'bg-red-900/30 text-red-200' : 'bg-emerald-900/30 text-emerald-200'}`}>
                     <Wifi size={14}/> {connectionStatus === 'connected' ? 'Online' : 'Offline'}
                   </span>
                 )}
                 {isNight && (
                   <span className="flex items-center gap-1.5 bg-indigo-900/30 px-3 py-1 rounded-full text-indigo-200"><Moon size={14}/> Nachtmodus</span>
                 )}
              </div>
            </div>
            
            <div className="flex gap-2">
              {'Notification' in window && (
                <button 
                  onClick={notifyPerm === 'granted' ? testNotification : requestNotifications} 
                  className={`p-4 rounded-full transition-colors active:scale-95 ${notifyPerm === 'granted' ? 'bg-emerald-900/30 text-emerald-200' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                >
                  {notifyPerm === 'granted' ? <BellRing size={24} /> : <BellOff size={24} />}
                </button>
              )}
              
              <button 
                onClick={() => setShowSettings(true)}
                className="bg-slate-800 text-slate-300 p-4 rounded-full hover:bg-slate-700 active:scale-95 transition-all"
              >
                <Settings size={24} />
              </button>

              {installPrompt && (
                <button onClick={handleInstallClick} className="bg-blue-600 text-white p-4 rounded-full shadow-lg active:scale-95 transition-all">
                  <Download size={24} />
                </button>
              )}
              <button onClick={hookData.refresh} className="bg-slate-800 text-slate-300 p-4 rounded-full hover:bg-slate-700 active:scale-95 transition-all">
                <RefreshCw size={24} className={connectionStatus === 'loading' ? 'animate-spin' : ''}/>
              </button>
            </div>
          </div>

          {connectionStatus === 'error' && errorMessage && (
            <div className="p-4 bg-red-900/20 border border-red-900/30 rounded-[20px] flex items-start gap-3 text-red-200 text-sm">
               <AlertTriangle className="shrink-0 mt-0.5" size={18}/>
               <div>
                 <span className="font-medium block mb-0.5">Verbindungsfehler</span>
                 {errorMessage}
               </div>
            </div>
          )}
        </header>

        {/* TOP STATS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <M3StatCard 
            icon={CloudRain} 
            label="Außen" 
            value={`${outside.temp}°`} 
            subValue={`TP: ${calculateDewPoint(outside.temp, outside.humidity).toFixed(1)}°`}
            theme="primary"
            onClick={() => window.open('https://wetter-app-sandy.vercel.app', '_blank')} 
          />
           <M3StatCard 
            icon={Home} 
            label="Ø Innen" 
            value={`${avgTemp}°`} 
            subValue="Temperatur"
            theme="secondary"
            onClick={() => setShowHeatingModal(true)} 
          />
           <M3StatCard 
            icon={Wind} 
            label="Fenster" 
            value={openWindows} 
            subValue={openWindows === 1 ? 'Offen' : 'Offen'}
            theme="tertiary"
            onClick={() => setShowWindowModal(true)}
          />
          {/* Gesamtstatus Kachel */}
          <div 
            onClick={() => setShowSummaryModal(true)}
            className={`${statusColorClass} p-5 rounded-[24px] flex flex-col justify-between h-32 cursor-pointer hover:opacity-90 active:scale-[0.98] transition-all`}
          >
             <div className="flex justify-between items-start">
                <Activity size={24} className={iconColor}/>
                <span className="text-3xl font-normal">{statusText}</span>
             </div>
             <div className="text-xs font-medium opacity-70 uppercase tracking-wider">Gesamtstatus</div>
          </div>
        </div>

        {/* ROOM GRID */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {rooms.map(room => (
            <RoomCardM3 
              key={room.id} 
              room={room} 
              outsideData={outside}
              settings={comfortSettings}
              allRooms={rooms}
              extensions={timerExtensions}
              activeSession={hookData.activeSessions[room.id]}
              smartLearning={hookData.smartLearning}
              onClick={() => setSelectedRoom(room)}
            />
          ))}
        </div>
        
        {/* MODALS */}
        {selectedRoom && (
          <M3Modal 
            room={selectedRoom} 
            outsideData={outside} 
            settings={comfortSettings}
            allRooms={rooms}
            extensions={timerExtensions}
            activeSession={hookData.activeSessions[selectedRoom.id]}
            smartLearning={hookData.smartLearning}
            onClose={() => setSelectedRoom(null)}
          />
        )}

        {showWindowModal && (
          <WindowListModal 
             rooms={rooms}
             onClose={() => setShowWindowModal(false)}
          />
        )}

        {showSettings && (
          <SettingsModal 
            settings={comfortSettings}
            onSave={handleSaveSettings}
            onClose={() => setShowSettings(false)}
          />
        )}

        {showHeatingModal && (
          <HeatingControlModal 
            rooms={rooms}
            setTemperature={setTemperature}
            setHvacMode={setHvacMode}
            onClose={() => setShowHeatingModal(false)}
          />
        )}

        {showSummaryModal && (
          <SummaryModal 
            rooms={rooms} 
            outside={outside} 
            settings={comfortSettings}
            extensions={timerExtensions}
            onClose={() => setShowSummaryModal(false)}
          />
        )}

      </div>
    </div>
  );
}
