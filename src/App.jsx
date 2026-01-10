import React, { useState, useEffect, useMemo } from 'react';
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
  Snowflake 
} from 'lucide-react';

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

const getTargetVentilationTime = (outsideTemp) => {
  if (outsideTemp < 5) return 5;
  if (outsideTemp < 10) return 10;
  if (outsideTemp < 20) return 20;
  return 30;
};

const formatTimeAgo = (dateString) => {
  if (!dateString) return '';
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  
  if (minutes < 1) return 'gerade eben';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  return '>1d';
};

const analyzeRoom = (room, outside, settings, allRooms, extensions = {}) => {
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
  
  const ventilationNeighborId = neighbors.find(nId => {
    const neighbor = allRooms.find(r => r.id === nId);
    return neighbor && neighbor.hasVentilation;
  });
  const ventilationNeighbor = ventilationNeighborId ? allRooms.find(r => r.id === ventilationNeighborId) : null;
  
  const isCrossVentilating = room.windowOpen && !!crossVentilationRoom;
  
  let targetMin = getTargetVentilationTime(outside.temp);
  if (isCrossVentilating) targetMin = Math.ceil(targetMin / 2);
  
  const sessionKey = `${room.id}-${room.lastWindowOpen}`;
  const extensionMin = extensions[sessionKey] || 0;
  const totalTargetMin = targetMin + extensionMin;
  
  const ventDurationText = `${totalTargetMin} Min`;

  if (room.temp < limits.tempMin) {
    score -= 20;
    issues.push({ type: 'temp', status: 'low', msg: 'Zu kalt' });
    if (!room.windowOpen) recommendations.push('Heizung prüfen');
  } else if (room.temp > limits.tempMax) {
    score -= 20;
    issues.push({ type: 'temp', status: 'high', msg: isNight ? 'Zu warm (Nacht)' : 'Zu warm' });
    
    if (outside.temp >= room.temp - 0.5) { 
        if (AC_CONNECTED_ROOMS.includes(room.id)) {
            if (room.id === 'bath') {
                recommendations.push('AC Modus (Lüftung) starten!');
            } else {
                recommendations.push('Klimaanlage im Bad nutzen (Türen auf)');
            }
        } else {
            recommendations.push('Abdunkeln (Draußen zu warm)');
        }
    } else {
        recommendations.push(isNight ? 'Fenster auf zum Abkühlen' : 'Heizung runterdrehen / Lüften');
    }
  }

  const dewPointInside = calculateDewPoint(room.temp, room.humidity);
  const dewPointOutside = calculateDewPoint(outside.temp, outside.humidity);

  if (room.humidity < limits.humMin) {
    score -= 15;
    issues.push({ type: 'hum', status: 'low', msg: 'Trockene Luft' });
    recommendations.push('Luftbefeuchter nutzen');
  } else if (room.humidity > limits.humMax) {
    score -= 30;
    issues.push({ type: 'hum', status: 'high', msg: 'Zu feucht' });
    
    if (dewPointOutside < dewPointInside) {
      if (room.windowOpen && room.lastWindowOpen) {
          const diffMs = Date.now() - new Date(room.lastWindowOpen).getTime();
          const openMin = diffMs / 60000;
          const remaining = Math.ceil(totalTargetMin - openMin);
          
          if (remaining > 0) {
             if (isCrossVentilating) {
                recommendations.push(`Querlüften aktiv: Noch ${remaining} Min.`);
             } else {
                recommendations.push(`Noch ${remaining} Min. lüften`);
                const potentialCross = neighbors.find(nId => {
                    const n = allRooms.find(r => r.id === nId);
                    return n && n.hasWindow && !n.windowOpen;
                });
                if (potentialCross) {
                    const nName = allRooms.find(r => r.id === potentialCross)?.name;
                    recommendations.push(`Tipp: Fenster in ${nName} öffnen für Durchzug!`);
                }
                if (ventilationNeighbor) {
                    recommendations.push(`Sogwirkung: Lüftung in ${ventilationNeighbor.name} an (Fenster dort zu)`);
                }
             }
          } else {
             recommendations.push(`Fenster schließen.`);
          }
      } else {
          recommendations.push(`Lüften: ${ventDurationText}`);
          if (room.hasVentilation) {
            recommendations.push('Falls möglich: Lüftung prüfen');
          } else if (ventilationNeighbor) {
            recommendations.push(`Effektiv: Fenster auf + Lüftung in ${ventilationNeighbor.name} an`);
          }
      }
    } else {
      recommendations.push('Lüften ineffektiv');
    }
  }

  if (room.hasCo2 && room.co2) {
    if (room.co2 > 1000) {
       const isCrit = room.co2 >= 1500;
       score -= isCrit ? 50 : 20;
       issues.push({ type: 'co2', status: isCrit ? 'crit' : 'warn', msg: isCrit ? 'Luft schlecht' : 'CO2 hoch' });
       
       if (room.windowOpen && room.lastWindowOpen) {
          const diffMs = Date.now() - new Date(room.lastWindowOpen).getTime();
          const openMin = diffMs / 60000;
          const remaining = Math.ceil(totalTargetMin - openMin);
          
          if (remaining > 0) {
             recommendations.push(`CO2: Noch ${remaining} Min.`);
          } else {
             recommendations.push(`Luft gut. Schließen.`);
          }
       } else {
          recommendations.push(isCrit ? `Sofort öffnen! (${ventDurationText})` : `Stoßlüften (${ventDurationText})`);
          if (ventilationNeighbor) {
             recommendations.push(`Tipp: Lüftung in ${ventilationNeighbor.name} dazu schalten`);
          }
       }
    }
  }

  const isVentilating = recommendations.some(r => r.includes('Noch') && r.includes('lüften'));
  if (room.windowOpen && room.temp < limits.tempMin && !isVentilating) {
    recommendations.push('Wärmeverlust!');
  }

  return {
    score: Math.max(0, score),
    issues,
    recommendations,
    dewPoint: dewPointInside.toFixed(1),
    isCrossVentilating,
    totalTargetMin,
    isNight
  };
};

// --- DATA HOOK ---

const useHomeAssistant = () => {
  const [rooms, setRooms] = useState(INITIAL_ROOMS);
  const [outside, setOutside] = useState(OUTSIDE_DATA);
  const [isDemoMode, setIsDemoMode] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [errorMessage, setErrorMessage] = useState('');

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

      const getAttr = (id, attr) => {
        const e = states.find(s => s.entity_id === id);
        return e ? e.attributes[attr] : null;
      };

      if (SENSOR_MAPPING.outside) {
        setOutside({
          temp: getNum(SENSOR_MAPPING.outside.temp) || OUTSIDE_DATA.temp,
          humidity: getNum(SENSOR_MAPPING.outside.humidity) || OUTSIDE_DATA.humidity,
          pressure: 1013,
          condition: 'Loaded'
        });
      }

      setRooms(prevRooms => prevRooms.map(room => {
        const map = SENSOR_MAPPING[room.id];
        const climateEntity = CLIMATE_MAPPING[room.id];
        
        if (!map) return room;

        const wSensor = states.find(s => s.entity_id === map.window);
        const wOpen = wSensor ? wSensor.state === 'on' : false;
        
        let lastOpen = room.lastWindowOpen;
        if (wOpen && wSensor) lastOpen = wSensor.last_changed;
        else if (!wOpen) lastOpen = null;

        let targetTemp = room.targetTemp;
        let hvacMode = room.hvacMode;
        if (climateEntity) {
           const e = states.find(s => s.entity_id === climateEntity);
           if (e) {
               targetTemp = e.attributes.temperature;
               hvacMode = e.state;
           }
        }

        return {
          ...room,
          temp: getNum(map.temp) || room.temp,
          humidity: getNum(map.humidity) || room.humidity,
          co2: map.co2 ? getNum(map.co2) : room.co2,
          windowOpen: wOpen,
          lastWindowOpen: lastOpen,
          targetTemp: targetTemp,
          hvacMode: hvacMode,
          climateEntity: climateEntity
        };
      }));

    } catch (error) {
      console.error("HA Fetch Error", error);
      setConnectionStatus('error');
      setErrorMessage('Verbindungsfehler');
    }
  };

  const setTemperature = async (entityId, newTemp) => {
    if (isDemoMode) {
      setRooms(prev => prev.map(r => r.climateEntity === entityId ? {...r, targetTemp: newTemp} : r));
      return;
    }

    try {
      await fetch(`${HA_URL}/api/services/climate/set_temperature`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${HA_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_id: entityId, temperature: newTemp })
      });
      setRooms(prev => prev.map(r => r.climateEntity === entityId ? {...r, targetTemp: newTemp} : r));
    } catch (e) {
      console.error("Set Temp Error", e);
      alert("Fehler beim Senden an Home Assistant");
    }
  };

  const setHvacMode = async (entityId, newMode) => {
    if (isDemoMode) {
      setRooms(prev => prev.map(r => r.climateEntity === entityId ? {...r, hvacMode: newMode} : r));
      return;
    }
    try {
      await fetch(`${HA_URL}/api/services/climate/set_hvac_mode`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${HA_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_id: entityId, hvac_mode: newMode })
      });
      setRooms(prev => prev.map(r => r.climateEntity === entityId ? {...r, hvacMode: newMode} : r));
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

  return { rooms, outside, isDemoMode, connectionStatus, errorMessage, refresh: fetchData, enableDemoMode, setTemperature, setHvacMode };
};

// --- SETTINGS MODAL ---
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
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="p-6 pb-4 border-b border-slate-800 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings size={20}/> Einstellungen
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-800 text-slate-400">
            <X size={20}/>
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-8">
          <div className="bg-blue-900/20 p-4 rounded-xl border border-blue-900/50 mb-6">
            <h3 className="text-sm font-bold text-blue-400 mb-1 flex items-center gap-2"><Sun size={14}/> Tag-Einstellungen (07-23 Uhr)</h3>
            <p className="text-xs text-slate-400">Nachts (23-07 Uhr) werden automatisch 18°C als Ziel verwendet.</p>
          </div>

          {Object.entries(localSettings).map(([key, config]) => (
            <div key={key} className="space-y-4">
              <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider border-b border-slate-800 pb-2">
                {config.label || key}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-slate-400 flex items-center gap-1"><Thermometer size={12}/> Temperatur Min/Max</label>
                  <div className="flex items-center gap-2">
                    <input type="number" value={config.tempMin} onChange={(e) => handleChange(key, 'tempMin', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-center focus:border-blue-500 outline-none"/>
                    <span className="text-slate-600">-</span>
                    <input type="number" value={config.tempMax} onChange={(e) => handleChange(key, 'tempMax', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-center focus:border-blue-500 outline-none"/>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-slate-400 flex items-center gap-1"><Droplets size={12}/> Feuchtigkeit Min/Max</label>
                  <div className="flex items-center gap-2">
                    <input type="number" value={config.humMin} onChange={(e) => handleChange(key, 'humMin', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-center focus:border-blue-500 outline-none"/>
                    <span className="text-slate-600">-</span>
                    <input type="number" value={config.humMax} onChange={(e) => handleChange(key, 'humMax', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-center focus:border-blue-500 outline-none"/>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex justify-between gap-4">
          <button onClick={handleReset} className="flex items-center gap-2 px-4 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"><RotateCcw size={18}/> Reset</button>
          <button onClick={() => onSave(localSettings)} className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/20"><Save size={18}/> Speichern</button>
        </div>
      </div>
    </div>
  );
};

// --- HEATING CONTROL MODAL ---
const HeatingControlModal = ({ rooms, setTemperature, setHvacMode, onClose }) => {
  const heatedRooms = rooms.filter(r => r.climateEntity);
  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="p-6 pb-4 border-b border-slate-800 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><Flame size={20} className="text-orange-500"/> Heizungssteuerung</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-800 text-slate-400"><X size={20}/></button>
        </div>
        <div className="p-6 overflow-y-auto space-y-4">
          {heatedRooms.length === 0 ? <div className="text-center text-slate-500 py-8">Keine steuerbaren Heizungen gefunden.</div> : heatedRooms.map(room => {
              const isOff = room.hvacMode === 'off';
              return (
              <div key={room.id} className="bg-slate-800/50 p-4 rounded-2xl flex justify-between items-center border border-slate-700">
                <div>
                  <div className="font-bold text-white">{room.name}</div>
                  <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">Ist: {room.temp}°C</div>
                </div>
                <div className="flex items-center gap-2">
                    <div className={`flex items-center gap-3 bg-slate-900 p-1.5 rounded-xl border border-slate-700 transition-opacity ${isOff ? 'opacity-50 pointer-events-none' : ''}`}>
                    <button onClick={() => setTemperature(room.climateEntity, (room.targetTemp || 20) - 1)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"><Minus size={16}/></button>
                    <div className="w-12 text-center font-bold text-lg text-orange-400">{room.targetTemp ? room.targetTemp.toFixed(1) : '--'}°</div>
                    <button onClick={() => setTemperature(room.climateEntity, (room.targetTemp || 20) + 1)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"><Plus size={16}/></button>
                    </div>
                    <button 
                      onClick={() => setHvacMode(room.climateEntity, isOff ? 'heat' : 'off')}
                      className={`p-3 rounded-xl border transition-colors ${isOff ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-emerald-900/30 border-emerald-800 text-emerald-400'}`}
                    >
                      <Power size={18} />
                    </button>
                </div>
              </div>
            )})}
        </div>
        <div className="p-4 border-t border-slate-800 bg-slate-900/50 text-center">
           <button onClick={onClose} className="px-8 py-2 rounded-full bg-slate-700 text-slate-200 font-medium hover:bg-slate-600 transition-colors">Fertig</button>
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
  let statusColorClass = "bg-emerald-900 text-emerald-400";
  let iconColor = "text-emerald-400";
  
  if (avgScore < 80) { 
      statusText = "Okay"; 
      statusColorClass = "bg-yellow-900 text-yellow-400"; 
      iconColor = "text-yellow-400";
  }
  if (avgScore < 60) { 
      statusText = "Mies"; 
      statusColorClass = "bg-red-900 text-red-400"; 
      iconColor = "text-red-400";
  }

  return (
    <div className={`min-h-screen ${statusColorClass} p-3 flex flex-col items-center justify-center`} onClick={() => window.open('/', '_self')}>
       <div className="flex justify-between w-full items-center mb-2">
          <div className="flex items-center gap-2">
             <Activity size={20} className={iconColor}/>
             <span className="text-xl font-bold text-white">{statusText} ({avgScore})</span>
          </div>
          <button onClick={(e) => { e.stopPropagation(); refresh(); }} className="p-1 rounded bg-black/20 text-white/70"><RefreshCw size={12}/></button>
       </div>
       
       <div className="w-full space-y-2 overflow-hidden flex-1">
          {roomsWithActions.length === 0 ? (
             <div className="text-center text-white/80 text-sm mt-4">
                Alles im grünen Bereich.
             </div>
          ) : (
             roomsWithActions.slice(0, 2).map((room, i) => (
                <div key={i} className="bg-black/20 p-2 rounded-lg text-xs text-white">
                   <div className="font-bold mb-0.5">{room.name}</div>
                   <div className="opacity-80 truncate">{room.recommendations[0]}</div>
                </div>
             ))
          )}
          {roomsWithActions.length > 2 && (
             <div className="text-center text-[10px] text-white/60">
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
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Klima Status</span>
                <button onClick={refresh} className="p-1 rounded hover:bg-slate-800"><RefreshCw size={14}/></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="bg-slate-900 p-4 rounded-2xl flex flex-col items-center border border-slate-800">
                  <CloudRain size={24} className="text-blue-400 mb-2"/><span className="text-3xl font-bold">{outside.temp}°</span><span className="text-[10px] text-slate-500 uppercase mt-1">Außen</span>
               </div>
               <div className="bg-slate-900 p-4 rounded-2xl flex flex-col items-center border border-slate-800">
                  <Home size={24} className="text-indigo-400 mb-2"/><span className="text-3xl font-bold">{avgTemp}°</span><span className="text-[10px] text-slate-500 uppercase mt-1">Ø Innen</span>
               </div>
            </div>
            <div className={`p-3 rounded-xl flex items-center justify-center gap-2 text-sm font-bold border transition-colors cursor-pointer hover:opacity-90 ${openWindows > 0 ? 'bg-red-900/40 text-red-300 border-red-900/50' : 'bg-emerald-900/30 text-emerald-400 border-emerald-900/40'}`} onClick={() => window.open('/', '_self')}>
                {openWindows > 0 ? <Wind size={18}/> : <CheckCircle size={18}/>}{openWindows > 0 ? `${openWindows} Fenster offen!` : 'Alle Fenster zu'}
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
      <div className="bg-slate-900 rounded-[28px] border border-slate-800 shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 p-6">
        <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-normal text-white">Fensterstatus</h3><button onClick={onClose} className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300"><X size={20}/></button></div>
        <div className="space-y-3">
          {openWindows.length > 0 ? (openWindows.map(room => (<div key={room.id} className="flex items-center gap-3 p-4 bg-slate-800 text-blue-200 rounded-2xl border border-slate-700"><div className="bg-blue-900/30 p-2 rounded-full text-blue-400"><Wind size={20}/></div><div><span className="font-medium block text-white">{room.name}</span><span className="text-xs opacity-70">Fenster geöffnet</span></div></div>))) : (<div className="flex flex-col items-center py-8 text-emerald-400 bg-emerald-900/20 rounded-2xl border border-emerald-900/30"><CheckCircle size={40} className="mb-3 opacity-80"/><span className="font-medium text-lg">Alle geschlossen</span><span className="text-sm opacity-70">Kein Fenster ist aktuell geöffnet</span></div>)}
        </div>
        <div className="mt-6 flex justify-end"><button onClick={onClose} className="px-5 py-2 rounded-full bg-slate-700 text-white text-sm font-medium hover:bg-slate-600 transition-colors">Schließen</button></div>
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
      <div className="bg-slate-900 rounded-[28px] border border-slate-800 shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 pb-4 border-b border-slate-800 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ListChecks size={20} className="text-indigo-400"/> Haus-Analyse
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-800 text-slate-400">
            <X size={20}/>
          </button>
        </div>
        <div className="p-6 overflow-y-auto space-y-4">
          {roomsWithActions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-emerald-400">
               <CheckCircle size={48} className="mb-4 opacity-80"/>
               <span className="text-lg font-bold">Alles Perfekt!</span>
               <span className="text-sm opacity-70 mt-1">Keine Maßnahmen erforderlich.</span>
            </div>
          ) : (
            roomsWithActions.map(room => (
              <div key={room.id} className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700">
                <div className="font-bold text-white mb-2 flex justify-between items-center">
                  {room.name}
                  {room.windowOpen && <span className="text-[10px] bg-blue-900/30 text-blue-300 px-2 py-0.5 rounded border border-blue-900/50">Offen</span>}
                </div>
                <ul className="space-y-2">
                  {room.recommendations.map((rec, i) => (
                    <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                       <span className="text-amber-500 mt-1">•</span>
                       {rec}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
        <div className="p-4 border-t border-slate-800 bg-slate-900/50 text-center">
           <button onClick={onClose} className="px-8 py-2 rounded-full bg-slate-700 text-slate-200 font-medium hover:bg-slate-600 transition-colors">Fertig</button>
        </div>
      </div>
    </div>
  );
};

// --- ROOM COMPONENTS ---

const M3StatCard = ({ icon: Icon, label, value, subValue, theme = 'primary', onClick }) => {
  const themes = {
    primary: 'bg-slate-800 text-blue-200 border border-slate-700',
    secondary: 'bg-slate-800 text-indigo-200 border border-slate-700',
    tertiary: 'bg-slate-800 text-orange-200 border border-slate-700',
    neutral: 'bg-slate-800 text-slate-200 border border-slate-700'
  };
  
  return (
    <div 
      onClick={onClick}
      className={`p-4 rounded-3xl flex flex-col justify-between h-28 ${themes[theme]} ${onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}`}
    >
      <div className="flex justify-between items-start">
        <Icon size={20} className="opacity-80"/>
        <span className="text-2xl font-semibold">{value}</span>
      </div>
      <div>
        <div className="text-xs font-medium opacity-70 uppercase tracking-wide">{label}</div>
        <div className="text-[10px] opacity-60 mt-0.5">{subValue}</div>
      </div>
    </div>
  );
};

const RoomCardM3 = ({ room, outsideData, settings, allRooms, extensions, onClick }) => {
  const analysis = useMemo(() => analyzeRoom(room, outsideData, settings, allRooms, extensions), [room, outsideData, settings, allRooms, extensions]);
  
  let containerClass = "bg-slate-800 border-slate-700";
  let scoreBadgeClass = "bg-emerald-900/50 text-emerald-400 border border-emerald-800";
  
  if (analysis.score < 80) { 
    containerClass = "bg-slate-800 border-yellow-900/50 shadow-[0_0_15px_rgba(234,179,8,0.1)]";
    scoreBadgeClass = "bg-yellow-900/50 text-yellow-400 border border-yellow-800"; 
  }
  if (analysis.score < 60) { 
    containerClass = "bg-slate-800 border-red-900/50 shadow-[0_0_15px_rgba(239,68,68,0.1)]"; 
    scoreBadgeClass = "bg-red-900/50 text-red-400 border border-red-800";
  }

  const countdownMsg = analysis.recommendations.find(r => r.includes('Noch') && r.includes('Min'));

  return (
    <div 
      onClick={onClick}
      className={`group relative p-4 rounded-3xl transition-all cursor-pointer border ${containerClass} ${room.windowOpen ? 'ring-1 ring-blue-500' : ''}`}
    >
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-3 overflow-hidden">
           <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${analysis.score < 60 ? 'bg-red-900/30 text-red-400' : 'bg-slate-700 text-slate-300'}`}>
             <Home size={16} />
           </div>
           <div className="min-w-0">
              <h3 className="font-medium text-base text-slate-100 leading-tight truncate">{room.name}</h3>
              {room.windowOpen && (
                 <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider flex items-center gap-1 mt-0.5">
                   Offen {formatTimeAgo(room.lastWindowOpen)}
                 </p>
              )}
           </div>
        </div>
        <div className={`px-2 py-0.5 rounded-full text-xs font-bold shrink-0 ${scoreBadgeClass}`}>
          {analysis.score}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="bg-slate-900/50 p-2 rounded-xl">
           <div className="text-[10px] text-slate-500 mb-0.5">Temp</div>
           <div className="text-lg font-medium text-slate-200">{room.temp ? room.temp.toFixed(1) : '-'}°</div>
        </div>
        <div className="bg-slate-900/50 p-2 rounded-xl">
           <div className="text-[10px] text-slate-500 mb-0.5">Feuchte</div>
           <div className={`text-lg font-medium ${analysis.issues.some(i => i.type === 'hum') ? 'text-red-400' : 'text-slate-200'}`}>
             {room.humidity || '-'}%
           </div>
        </div>
      </div>

      {analysis.recommendations.length > 0 && (
         <div className={`mt-2 flex items-start gap-2 text-[11px] p-2 rounded-xl ${countdownMsg ? 'bg-blue-900/30 text-blue-300 border border-blue-900/50' : 'bg-slate-900/30 text-slate-400'}`}>
            {analysis.isCrossVentilating && <ArrowRightLeft size={14} className="mt-0.5 shrink-0 text-blue-400"/>}
            {countdownMsg && !analysis.isCrossVentilating && <Timer size={14} className="mt-0.5 shrink-0"/>}
            {!countdownMsg && !analysis.isCrossVentilating && analysis.recommendations.some(r => r.includes('Klima') || r.includes('AC')) && <Snowflake size={14} className="mt-0.5 shrink-0 text-blue-400"/>}
            {!countdownMsg && !analysis.isCrossVentilating && !analysis.recommendations.some(r => r.includes('Klima') || r.includes('AC')) && <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-500"/>}
            <span className="line-clamp-1 leading-snug">{countdownMsg || analysis.recommendations[0]}</span>
         </div>
      )}
    </div>
  );
};

const M3Modal = ({ room, outsideData, settings, allRooms, extensions, onClose }) => {
  if (!room) return null;
  const analysis = useMemo(() => analyzeRoom(room, outsideData, settings, allRooms, extensions), [room, outsideData, settings, allRooms, extensions]);
  const limits = settings[room.type] || settings.default;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 rounded-[28px] border border-slate-800 shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 pb-2 flex justify-between items-start">
           <div>
             <h2 className="text-2xl font-bold text-white">{room.name}</h2>
             <p className="text-slate-400 text-sm mt-1">Details & Analyse {analysis.isNight && '(Nachtmodus)'}</p>
           </div>
           <button onClick={onClose} className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors">
             <X size={20}/>
           </button>
        </div>

        <div className="p-6 pt-4 overflow-y-auto">
          <div className={`mb-6 p-4 rounded-3xl flex items-center gap-4 ${analysis.score >= 80 ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-900/50' : analysis.score >= 60 ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-900/50' : 'bg-red-900/30 text-red-400 border border-red-900/50'}`}>
             <div className="text-4xl font-bold">{analysis.score}</div>
             <div className="text-sm opacity-90 border-l border-current pl-4 leading-tight font-medium">
               Klima-<br/>Score
             </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
             <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1"><Thermometer size={14}/> Temperatur</div>
                <div className="text-2xl font-medium text-white">{room.temp}°C</div>
                <div className="text-[10px] text-slate-500 mt-1">Ziel: {limits.tempMin}-{limits.tempMax}°</div>
             </div>
             
             <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1"><Droplets size={14}/> Feuchte</div>
                <div className="text-2xl font-medium text-white">{room.humidity}%</div>
                <div className="text-[10px] text-slate-500 mt-1">Taupunkt: {analysis.dewPoint}°</div>
             </div>

             {room.hasCo2 && (
               <div className="col-span-2 bg-slate-800 p-4 rounded-2xl border border-slate-700 flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2 text-slate-400 text-xs mb-1"><Wind size={14}/> CO2 Belastung</div>
                    <div className="text-xl font-medium text-white">{room.co2} ppm</div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold ${room.co2 < 1000 ? 'bg-emerald-900/50 text-emerald-400' : 'bg-red-900/50 text-red-400'}`}>
                     {room.co2 < 1000 ? 'Gut' : 'Schlecht'}
                  </div>
               </div>
             )}
          </div>

          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Empfehlungen</h3>
          <div className="space-y-3">
             {analysis.recommendations.length > 0 ? analysis.recommendations.map((rec, i) => (
                <div key={i} className={`flex gap-3 p-3 rounded-2xl items-start ${rec.includes('Noch') ? 'bg-blue-900/30 text-blue-200 border border-blue-900/50' : 'bg-slate-800 border border-slate-700 text-slate-300'}`}>
                   <div className="mt-0.5 opacity-70">
                      {rec.includes('Klima') || rec.includes('AC') ? <Snowflake size={16}/> : rec.includes('Querlüften') ? <ArrowRightLeft size={16}/> : rec.includes('Noch') ? <Timer size={16}/> : <Activity size={16}/>}
                   </div>
                   <div className="text-sm font-medium">{rec}</div>
                </div>
             )) : (
               <div className="flex gap-3 p-4 rounded-2xl bg-emerald-900/20 text-emerald-400 border border-emerald-900/30 items-center">
                  <CheckCircle size={20} />
                  <span className="font-medium text-sm">Perfektes Klima.</span>
               </div>
             )}
          </div>

           <div className="mt-6 pt-6 border-t border-slate-800 space-y-3">
              {room.hasWindow && (
                <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Fenster</span>
                    <div className="flex items-center gap-2">
                      {room.windowOpen ? (
                        <span className="flex items-center gap-2 text-blue-400 font-medium px-3 py-1 bg-blue-900/20 rounded-full border border-blue-900/30">
                          <Wind size={12}/> Offen
                        </span>
                      ) : (
                        <span className="text-slate-400">Geschlossen</span>
                      )}
                    </div>
                </div>
              )}
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

  const { refresh, enableDemoMode, setTemperature, setHvacMode } = useHomeAssistant();

  useEffect(() => {
    const fetchData = async () => {
      if (!HA_URL || !HA_TOKEN) {
        setIsDemoMode(true);
        setRooms(prev => prev.map(r => ({
           ...r,
           temp: Number((r.temp + (Math.random() - 0.5) * 0.1).toFixed(1))
        })));
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

        setRooms(prevRooms => prevRooms.map(room => {
          const map = SENSOR_MAPPING[room.id];
          const climateEntity = CLIMATE_MAPPING[room.id];
          
          if (!map) return room;

          const wSensor = states.find(s => s.entity_id === map.window);
          const wOpen = wSensor ? wSensor.state === 'on' : false;
          
          let lastOpen = room.lastWindowOpen;
          if (wOpen && wSensor) lastOpen = wSensor.last_changed;
          else if (!wOpen) lastOpen = null;

          let targetTemp = room.targetTemp;
          let hvacMode = room.hvacMode;
          if (climateEntity) {
             const e = states.find(s => s.entity_id === climateEntity);
             if (e) {
                 targetTemp = e.attributes.temperature;
                 hvacMode = e.state;
             }
          }

          return {
            ...room,
            temp: getNum(map.temp) || room.temp,
            humidity: getNum(map.humidity) || room.humidity,
            co2: map.co2 ? getNum(map.co2) : room.co2,
            windowOpen: wOpen,
            lastWindowOpen: lastOpen,
            targetTemp: targetTemp,
            hvacMode: hvacMode,
            climateEntity: climateEntity
          };
        }));

      } catch (error) {
        console.error("HA Fetch Error", error);
        setConnectionStatus('error');
        setErrorMessage('Verbindungsfehler');
      }
    };

    fetchData();
    const interval = setInterval(fetchData, isWidgetMode ? 60000 : 10000);
    return () => clearInterval(interval);
  }, [isWidgetMode]);

  useEffect(() => {
    if ('Notification' in window) {
      setNotifyPerm(Notification.permission);
    }
  }, []);

  const sendNotification = (title, options) => {
    if (Notification.permission !== 'granted') return;
    
    const extOptions = {
        ...options,
        vibrate: [200, 100, 200], 
        requireInteraction: true,  
        icon: '/pwa-192x192.png'
    };

    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title, extOptions);
        });
      } else {
        new Notification(title, extOptions);
      }
    } catch (e) {
      console.error('Notify failed', e);
    }
  };

  useEffect(() => {
    if (notifyPerm !== 'granted') return;

    rooms.forEach(room => {
      if (!room.windowOpen || !room.lastWindowOpen) return;

      const limits = comfortSettings[room.type] || comfortSettings.default;
      const analysis = analyzeRoom(room, outside, comfortSettings, rooms, timerExtensions); 
      const targetMin = getTargetVentilationTime(outside.temp);
      const diffMs = Date.now() - new Date(room.lastWindowOpen).getTime();
      const openMin = diffMs / 60000;
      
      let adjustedTarget = targetMin;
      if (analysis.isCrossVentilating) adjustedTarget = Math.ceil(targetMin / 2);
      
      const remaining = adjustedTarget - openMin;
      
      const sessionBase = `${room.id}-${room.lastWindowOpen}`;
      const startKey = `${sessionBase}-start`;
      const coldKey = `${sessionBase}-cold`;
      const timerKey = `${sessionBase}-timer`;
      const qualityKey = `${sessionBase}-quality`;

      if (!notifiedSessions.has(startKey)) {
         sendNotification(`Lüftung gestartet: ${room.name}`, {
            body: `Timer gesetzt auf ${adjustedTarget} Minuten.${analysis.isCrossVentilating ? ' (Querlüften aktiv)' : ''}`,
            tag: startKey
         });
         setNotifiedSessions(prev => new Set(prev).add(startKey));
      }

      if (room.temp < limits.tempMin && !notifiedSessions.has(coldKey)) {
         sendNotification(`Achtung Kälte: ${room.name}`, {
            body: `Temperatur ist auf ${room.temp}°C gefallen. Fenster schließen!`,
            tag: coldKey,
            icon: '/pwa-192x192.png'
         });
         setNotifiedSessions(prev => new Set(prev).add(coldKey));
      }

      if (remaining <= 0) {
          const hasIssues = analysis.issues.some(i => (i.type === 'hum' && i.status === 'high') || i.type === 'co2');
          
          if (hasIssues && (timerExtensions[sessionBase] || 0) < 30) {
               const newExtension = (timerExtensions[sessionBase] || 0) + 5;
               const extensionKey = `${sessionBase}-ext-${newExtension}`;
               
               if (!notifiedSessions.has(extensionKey)) {
                   setTimerExtensions(prev => ({...prev, [sessionBase]: newExtension}));
                   setNotifiedSessions(prev => new Set(prev).add(extensionKey));
                   
                   sendNotification(`Luft noch nicht gut: ${room.name}`, {
                        body: `Timer um 5 Minuten verlängert.`,
                        tag: extensionKey
                   });
               }
          } else {
               const finalKey = `${sessionBase}-final-${adjustedTarget + (timerExtensions[sessionBase] || 0)}`;
               if (!notifiedSessions.has(finalKey)) {
                   sendNotification(`Fenster schließen: ${room.name}`, {
                        body: `Zeit abgelaufen.`,
                        tag: finalKey
                   });
                   setNotifiedSessions(prev => new Set(prev).add(finalKey));
               }
          }
      }

      const hasIssues = analysis.issues.some(i => i.type === 'hum' && i.status === 'high' || i.type === 'co2');
      if (!hasIssues && openMin > 2 && !notifiedSessions.has(qualityKey)) {
         sendNotification(`Luft gut: ${room.name}`, {
            body: `Werte sind im grünen Bereich.`,
            tag: qualityKey
         });
         setNotifiedSessions(prev => new Set(prev).add(qualityKey));
      }
    });
  }, [rooms, outside, notifiedSessions, notifyPerm, comfortSettings, timerExtensions]);

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
    return <WidgetView outside={outside} rooms={rooms} refresh={() => window.location.reload()} />;
  }
  
  if (isWidgetMode === 'widget-summary') {
     return <SummaryWidgetView rooms={rooms} outside={outside} settings={comfortSettings} extensions={timerExtensions} refresh={() => window.location.reload()} />;
  }

  const avgTemp = (rooms.reduce((acc, r) => acc + r.temp, 0) / rooms.length).toFixed(1);
  const openWindows = rooms.filter(r => r.windowOpen).length;
  const avgScore = Math.round(rooms.reduce((acc, r) => acc + analyzeRoom(r, outside, comfortSettings, rooms, timerExtensions).score, 0) / rooms.length);
  let statusText = "Gut";
  let statusColorClass = "bg-emerald-900/20 text-emerald-400 border border-emerald-900/30";
  if (avgScore < 80) { statusText = "Okay"; statusColorClass = "bg-yellow-900/20 text-yellow-400 border border-yellow-900/30"; }
  if (avgScore < 60) { statusText = "Mies"; statusColorClass = "bg-red-900/20 text-red-400 border border-red-900/30"; }

  const hour = new Date().getHours();
  const isNight = hour >= 23 || hour < 7;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-4 safe-area-inset-bottom">
      <div className="max-w-7xl mx-auto pb-8">
        
        {/* HEADER */}
        <header className="mb-6 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Raumklima</h1>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                 {isDemoMode ? (
                   <span className="flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded text-slate-300"><WifiOff size={10}/> Demo</span>
                 ) : (
                   <span className={`flex items-center gap-1 px-2 py-0.5 rounded ${connectionStatus === 'error' ? 'bg-red-900/50 text-red-300' : 'bg-emerald-900/50 text-emerald-300'}`}>
                     <Wifi size={10}/> {connectionStatus === 'connected' ? 'Online' : 'Offline'}
                   </span>
                 )}
                 {isNight && (
                   <span className="flex items-center gap-1 bg-indigo-900/50 px-2 py-0.5 rounded text-indigo-300 border border-indigo-900/50"><Moon size={10}/> Nachtmodus</span>
                 )}
              </div>
            </div>
            
            <div className="flex gap-2">
              {'Notification' in window && (
                <button 
                  onClick={notifyPerm === 'granted' ? testNotification : requestNotifications} 
                  className={`p-3 rounded-full border transition-colors ${notifyPerm === 'granted' ? 'bg-emerald-900/30 border-emerald-800 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-300'}`}
                >
                  {notifyPerm === 'granted' ? <BellRing size={20} /> : <BellOff size={20} />}
                </button>
              )}
              
              <button 
                onClick={() => setShowSettings(true)}
                className="bg-slate-800 text-slate-300 p-3 rounded-full hover:bg-slate-700 border border-slate-700"
              >
                <Settings size={20} />
              </button>

              {installPrompt && (
                <button onClick={handleInstallClick} className="bg-blue-600 text-white p-3 rounded-full shadow-lg">
                  <Download size={20} />
                </button>
              )}
              <button onClick={refresh} className="bg-slate-800 text-slate-300 p-3 rounded-full hover:bg-slate-700 border border-slate-700">
                <RefreshCw size={20} className={connectionStatus === 'loading' ? 'animate-spin' : ''}/>
              </button>
            </div>
          </div>

          {connectionStatus === 'error' && errorMessage && (
            <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-xl flex items-start gap-3 text-red-300 text-xs">
               <AlertTriangle className="shrink-0 mt-0.5" size={14}/>
               <div>
                 <span className="font-bold block mb-0.5">Fehler</span>
                 {errorMessage}
               </div>
            </div>
          )}
        </header>

        {/* TOP STATS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <M3StatCard 
            icon={CloudRain} 
            label="Außen" 
            value={`${outside.temp}°`} 
            subValue={`TP: ${calculateDewPoint(outside.temp, outside.humidity).toFixed(1)}°`}
            theme="primary"
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
            className={`${statusColorClass} p-4 rounded-3xl flex flex-col justify-between h-28 cursor-pointer hover:shadow-lg transition-all`}
          >
             <div className="flex justify-between items-start">
                <Activity size={20} className="opacity-80"/>
                <span className="text-2xl font-bold">{statusText}</span>
             </div>
             <div className="text-xs opacity-70">Gesamtstatus</div>
          </div>
        </div>

        {/* ROOM GRID */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {rooms.map(room => (
            <RoomCardM3 
              key={room.id} 
              room={room} 
              outsideData={outside}
              settings={comfortSettings}
              allRooms={rooms}
              extensions={timerExtensions}
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
