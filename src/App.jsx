import React, { useState, useEffect, useMemo } from 'react';
import { 
  Thermometer, 
  Droplets, 
  Wind, 
  Activity, 
  Home, 
  AlertCircle, 
  CheckCircle, 
  CloudRain,
  RefreshCw,
  X,
  Wifi,
  WifiOff,
  Timer,
  Fan,
  AlertTriangle,
  Lock,
  Download,
  Bell,
  BellOff
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

const COMFORT_RANGES = {
  living: { tempMin: 20, tempMax: 23, humMin: 40, humMax: 60 },
  sleeping: { tempMin: 16, tempMax: 19, humMin: 40, humMax: 60 },
  bathroom: { tempMin: 21, tempMax: 24, humMin: 40, humMax: 70 },
  storage: { tempMin: 10, tempMax: 25, humMin: 30, humMax: 65 },
  default: { tempMin: 19, tempMax: 22, humMin: 40, humMax: 60 }
};

const INITIAL_ROOMS = [
  { id: 'living', name: 'Wohnzimmer', type: 'living', hasCo2: true, hasWindow: true, hasVentilation: false, temp: 21.5, humidity: 45, co2: 650, windowOpen: false, lastWindowOpen: null },
  { id: 'kitchen', name: 'Küche', type: 'living', hasCo2: false, hasWindow: true, hasVentilation: false, temp: 22.1, humidity: 68, co2: null, windowOpen: true, lastWindowOpen: null }, 
  { id: 'bedroom', name: 'Schlafzimmer', type: 'sleeping', hasCo2: true, hasWindow: true, hasVentilation: true, temp: 18.0, humidity: 50, co2: 900, windowOpen: false, lastWindowOpen: null },
  { id: 'kids', name: 'Kinderzimmer', type: 'sleeping', hasCo2: false, hasWindow: true, hasVentilation: true, temp: 20.5, humidity: 55, co2: null, windowOpen: false, lastWindowOpen: null },
  { id: 'play', name: 'Spielzimmer', type: 'living', hasCo2: false, hasWindow: false, hasVentilation: false, temp: 21.0, humidity: 48, co2: null, windowOpen: null, lastWindowOpen: null },
  { id: 'bath', name: 'Bad', type: 'bathroom', hasCo2: false, hasWindow: true, hasVentilation: true, temp: 23.5, humidity: 82, co2: null, windowOpen: false, lastWindowOpen: null },
  { id: 'dining', name: 'Esszimmer', type: 'living', hasCo2: false, hasWindow: false, hasVentilation: false, temp: 21.2, humidity: 46, co2: null, windowOpen: null, lastWindowOpen: null },
  { id: 'basement', name: 'Keller', type: 'storage', hasCo2: false, hasWindow: true, hasVentilation: false, temp: 14.0, humidity: 60, co2: null, windowOpen: false, lastWindowOpen: null },
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

const analyzeRoom = (room, outside) => {
  const limits = COMFORT_RANGES[room.type] || COMFORT_RANGES.default;
  let score = 100;
  let issues = [];
  let recommendations = [];

  const targetMin = getTargetVentilationTime(outside.temp);
  const ventDurationText = `${targetMin} Min`;

  // Temp Check
  if (room.temp < limits.tempMin) {
    score -= 20;
    issues.push({ type: 'temp', status: 'low', msg: 'Zu kalt' });
    if (!room.windowOpen) recommendations.push('Heizung prüfen');
  } else if (room.temp > limits.tempMax) {
    score -= 20;
    issues.push({ type: 'temp', status: 'high', msg: 'Zu warm' });
    recommendations.push('Heizung runterdrehen');
  }

  // Humidity Check
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
          const remaining = Math.ceil(targetMin - openMin);
          
          if (remaining > 0) {
             recommendations.push(`Noch ${remaining} Min. lüften`);
          } else {
             recommendations.push(`Fenster schließen.`);
          }
      } else {
          recommendations.push(`Lüften: ${ventDurationText}`);
          if (room.hasVentilation) {
            recommendations.push('Falls möglich: Lüftung prüfen');
          }
      }
    } else {
      recommendations.push('Lüften ineffektiv');
    }
  }

  // CO2 Check
  if (room.hasCo2 && room.co2) {
    if (room.co2 > 1000) {
       const isCrit = room.co2 >= 1500;
       score -= isCrit ? 50 : 20;
       issues.push({ type: 'co2', status: isCrit ? 'crit' : 'warn', msg: isCrit ? 'Luft schlecht' : 'CO2 hoch' });
       
       if (room.windowOpen && room.lastWindowOpen) {
          const diffMs = Date.now() - new Date(room.lastWindowOpen).getTime();
          const openMin = diffMs / 60000;
          const remaining = Math.ceil(targetMin - openMin);
          
          if (remaining > 0) {
             recommendations.push(`CO2: Noch ${remaining} Min.`);
          } else {
             recommendations.push(`Luft gut. Schließen.`);
          }
       } else {
          recommendations.push(isCrit ? `Sofort öffnen! (${ventDurationText})` : `Stoßlüften (${ventDurationText})`);
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
    dewPoint: dewPointInside.toFixed(1)
  };
};

// --- COMPONENTS ---

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
      className={`p-4 rounded-3xl flex flex-col justify-between h-28 ${themes[theme]} ${onClick ? 'cursor-pointer' : ''}`}
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

const RoomCardM3 = ({ room, outsideData, onClick }) => {
  const analysis = useMemo(() => analyzeRoom(room, outsideData), [room, outsideData]);
  
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
            {countdownMsg ? <Timer size={14} className="mt-0.5 shrink-0"/> : <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-500"/>}
            <span className="line-clamp-1 leading-snug">{countdownMsg || analysis.recommendations[0]}</span>
         </div>
      )}
    </div>
  );
};

const M3Modal = ({ room, outsideData, onClose }) => {
  if (!room) return null;
  const analysis = useMemo(() => analyzeRoom(room, outsideData), [room, outsideData]);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 rounded-[28px] border border-slate-800 shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 pb-2 flex justify-between items-start">
           <div>
             <h2 className="text-2xl font-bold text-white">{room.name}</h2>
             <p className="text-slate-400 text-sm mt-1">Details & Analyse</p>
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
                <div className="text-[10px] text-slate-500 mt-1">Ziel: {COMFORT_RANGES[room.type]?.tempMin}-{COMFORT_RANGES[room.type]?.tempMax}°</div>
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
                      {rec.includes('Noch') ? <Timer size={16}/> : <Activity size={16}/>}
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

const WindowListModal = ({ rooms, onClose }) => {
  const openWindows = rooms.filter(r => r.windowOpen);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 rounded-[28px] border border-slate-800 shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 p-6">
        <div className="flex justify-between items-center mb-4">
           <h3 className="text-xl font-normal text-white">Fensterstatus</h3>
           <button onClick={onClose} className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300">
             <X size={20}/>
           </button>
        </div>
        
        <div className="space-y-3">
          {openWindows.length > 0 ? (
            openWindows.map(room => (
              <div key={room.id} className="flex items-center gap-3 p-4 bg-slate-800 text-blue-200 rounded-2xl border border-slate-700">
                 <div className="bg-blue-900/30 p-2 rounded-full text-blue-400">
                    <Wind size={20}/>
                 </div>
                 <div>
                   <span className="font-medium block text-white">{room.name}</span>
                   <span className="text-xs opacity-70">Fenster geöffnet</span>
                 </div>
              </div>
            ))
          ) : (
             <div className="flex flex-col items-center py-8 text-emerald-400 bg-emerald-900/20 rounded-2xl border border-emerald-900/30">
                <CheckCircle size={40} className="mb-3 opacity-80"/>
                <span className="font-medium text-lg">Alle geschlossen</span>
                <span className="text-sm opacity-70">Kein Fenster ist aktuell geöffnet</span>
             </div>
          )}
        </div>
        
        <div className="mt-6 flex justify-end">
           <button onClick={onClose} className="px-5 py-2 rounded-full bg-slate-700 text-white text-sm font-medium hover:bg-slate-600 transition-colors">
             Schließen
           </button>
        </div>
      </div>
    </div>
  );
};

// --- MAIN APP COMPONENT ---

export default function App() {
  // STATE DEFINITIONS - WICHTIG: showWindowModal ist hier definiert!
  const [rooms, setRooms] = useState(INITIAL_ROOMS);
  const [outside, setOutside] = useState(OUTSIDE_DATA);
  const [isDemoMode, setIsDemoMode] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [errorMessage, setErrorMessage] = useState('');
  
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showWindowModal, setShowWindowModal] = useState(false); // Hier ist die fehlende Definition
  const [installPrompt, setInstallPrompt] = useState(null);
  
  const [notifiedSessions, setNotifiedSessions] = useState(new Set());
  const [notifyPerm, setNotifyPerm] = useState('default');

  // Home Assistant Logic
  useEffect(() => {
    const fetchData = async () => {
      if (!HA_URL || !HA_TOKEN) {
        setIsDemoMode(true);
        setRooms(prev => prev.map(r => ({
           ...r,
           temp: Number((r.temp + (Math.random() - 0.5) * 0.4).toFixed(1))
        })));
        return;
      }

      // Check HTTPS/HTTP
      if (window.location.protocol === 'https:' && HA_URL.startsWith('http://')) {
          setConnectionStatus('error');
          setErrorMessage('HTTPS/HTTP Konflikt. Bitte Nabu Casa URL nutzen.');
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

        // Update Outside
        if (SENSOR_MAPPING.outside) {
          setOutside({
            temp: getNum(SENSOR_MAPPING.outside.temp) || OUTSIDE_DATA.temp,
            humidity: getNum(SENSOR_MAPPING.outside.humidity) || OUTSIDE_DATA.humidity,
            pressure: 1013,
            condition: 'Loaded'
          });
        }

        // Update Rooms
        setRooms(prevRooms => prevRooms.map(room => {
          const map = SENSOR_MAPPING[room.id];
          if (!map) return room;

          const wSensor = states.find(s => s.entity_id === map.window);
          const wOpen = wSensor ? wSensor.state === 'on' : false;
          
          let lastOpen = room.lastWindowOpen;
          if (wOpen && wSensor) lastOpen = wSensor.last_changed;
          else if (!wOpen) lastOpen = null;

          return {
            ...room,
            temp: getNum(map.temp) || room.temp,
            humidity: getNum(map.humidity) || room.humidity,
            co2: map.co2 ? getNum(map.co2) : room.co2,
            windowOpen: wOpen,
            lastWindowOpen: lastOpen
          };
        }));

      } catch (error) {
        console.error("HA Fetch Error", error);
        setConnectionStatus('error');
        setErrorMessage('Verbindungsfehler (CORS?)');
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []); // Run on mount

  // Notification Permission Check
  useEffect(() => {
    if ('Notification' in window) {
      setNotifyPerm(Notification.permission);
    }
  }, []);

  // Send Notification Helper
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

  // Check Logic
  useEffect(() => {
    if (notifyPerm !== 'granted') return;

    rooms.forEach(room => {
      if (!room.windowOpen || !room.lastWindowOpen) return;

      const analysis = analyzeRoom(room, outside);
      const targetMin = getTargetVentilationTime(outside.temp);
      const diffMs = Date.now() - new Date(room.lastWindowOpen).getTime();
      const openMin = diffMs / 60000;
      const remaining = targetMin - openMin;
      
      const sessionBase = `${room.id}-${room.lastWindowOpen}`;
      const timerKey = `${sessionBase}-timer`;
      const qualityKey = `${sessionBase}-quality`;

      // 1. Time Expired
      if (remaining <= 0 && !notifiedSessions.has(timerKey)) {
         sendNotification(`Fenster schließen: ${room.name}`, {
            body: `Zeit abgelaufen (${targetMin} Min).`,
            tag: timerKey
         });
         setNotifiedSessions(prev => new Set(prev).add(timerKey));
      }

      // 2. Air Quality Good
      const issues = analysis.issues;
      const hasIssues = issues.some(i => i.type === 'hum' && i.status === 'high' || i.type === 'co2');
      
      if (!hasIssues && openMin > 2 && !notifiedSessions.has(qualityKey)) {
         sendNotification(`Luft gut: ${room.name}`, {
            body: `Werte sind im grünen Bereich.`,
            tag: qualityKey
         });
         setNotifiedSessions(prev => new Set(prev).add(qualityKey));
      }
    });
  }, [rooms, outside, notifiedSessions, notifyPerm]);

  // Install Prompt Logic
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

  const avgTemp = (rooms.reduce((acc, r) => acc + r.temp, 0) / rooms.length).toFixed(1);
  const openWindows = rooms.filter(r => r.windowOpen).length;

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
              </div>
            </div>
            
            <div className="flex gap-2">
              {/* Notif Button */}
              {'Notification' in window && (
                <button 
                  onClick={notifyPerm === 'granted' ? () => sendNotification('Test', {body:'Test OK'}) : requestNotifications} 
                  className={`p-3 rounded-full border transition-colors ${notifyPerm === 'granted' ? 'bg-emerald-900/30 border-emerald-800 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-300'}`}
                >
                  {notifyPerm === 'granted' ? <Bell size={20} /> : <BellOff size={20} />}
                </button>
              )}
              
              {installPrompt && (
                <button onClick={handleInstallClick} className="bg-blue-600 text-white p-3 rounded-full shadow-lg">
                  <Download size={20} />
                </button>
              )}
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
          />
           <M3StatCard 
            icon={Wind} 
            label="Fenster" 
            value={openWindows} 
            subValue={openWindows === 1 ? 'Offen' : 'Offen'}
            theme="tertiary"
            onClick={() => setShowWindowModal(true)}
          />
          <div className="bg-emerald-900/20 text-emerald-400 border border-emerald-900/30 p-4 rounded-3xl flex flex-col justify-between h-28">
             <div className="flex justify-between items-start">
                <Activity size={20} className="opacity-80"/>
                <span className="text-2xl font-bold">Gut</span>
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
              onClick={() => setSelectedRoom(room)}
            />
          ))}
        </div>
        
        {/* MODALS */}
        {selectedRoom && (
          <M3Modal 
            room={selectedRoom} 
            outsideData={outside}
            onClose={() => setSelectedRoom(null)}
          />
        )}

        {showWindowModal && (
          <WindowListModal 
             rooms={rooms}
             onClose={() => setShowWindowModal(false)}
          />
        )}

      </div>
    </div>
  );
}
