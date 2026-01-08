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
  MoreVertical,
  ArrowUpRight,
  Wifi,
  WifiOff,
  Timer,
  Fan,
  AlertTriangle,
  Lock
} from 'lucide-react';

// --- KONFIGURATION FÜR HOME ASSISTANT ---

// Helper für sicheren Zugriff auf Environment Variables
const getEnv = () => {
  try {
    return (import.meta && import.meta.env) ? import.meta.env : {};
  } catch (e) {
    return {};
  }
};
const env = getEnv();

// 1. URL: Wird später über Vercel (Environment Variables) gesetzt
const HA_URL = env.VITE_HA_URL || ""; 

// 2. Token: Wird später über Vercel gesetzt
const HA_TOKEN = env.VITE_HA_TOKEN || "";

// 3. Mapping: Hier verknüpfst du die App-IDs mit deinen echten Sensor-Namen aus Home Assistant
const SENSOR_MAPPING = {
  living: { 
    temp: 'sensor.smart_radiator_thermostat_x_temperatur', 
    humidity: 'sensor.smart_radiator_thermostat_x_luftfeuchtigkeit', 
    co2: 'sensor.indoor_co2', 
    window: 'binary_sensor.terrassentur_tur' 
  },
  kitchen: { 
    temp: 'sensor.indoor_aussentemperatur_temperature', 
    // NEU: Feuchtigkeitssensor hinzugefügt
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
  
  // Wetterstation
  outside: {
    temp: 'sensor.hp2550a_pro_v1_6_7_outdoor_temperature',
    humidity: 'sensor.hp2550a_pro_v1_6_7_humidity'
  }
};

// --- EINSTELLUNGEN ---

const COMFORT_RANGES = {
  living: { tempMin: 20, tempMax: 23, humMin: 40, humMax: 60 },
  sleeping: { tempMin: 16, tempMax: 19, humMin: 40, humMax: 60 },
  bathroom: { tempMin: 21, tempMax: 24, humMin: 40, humMax: 70 },
  storage: { tempMin: 10, tempMax: 25, humMin: 30, humMax: 65 },
  default: { tempMin: 19, tempMax: 22, humMin: 40, humMax: 60 }
};

const INITIAL_ROOMS = [
  { id: 'living', name: 'Wohnzimmer', type: 'living', hasCo2: true, hasWindow: true, hasVentilation: false, temp: 21.5, humidity: 45, co2: 650, windowOpen: false, lastWindowOpen: null },
  { id: 'kitchen', name: 'Küche', type: 'living', hasCo2: false, hasWindow: true, hasVentilation: false, temp: 22.1, humidity: 68, co2: null, windowOpen: true, lastWindowOpen: new Date(Date.now() - 1000 * 60 * 5).toISOString() }, 
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

// --- LOGIK & ALGORITHMEN ---

const calculateDewPoint = (T, RH) => {
  if (!T || !RH) return 0;
  const a = 17.27;
  const b = 237.7;
  const alpha = ((a * T) / (b + T)) + Math.log(RH / 100.0);
  return (b * alpha) / (a - alpha);
};

const analyzeRoom = (room, outside) => {
  const limits = COMFORT_RANGES[room.type] || COMFORT_RANGES.default;
  let score = 100;
  let issues = [];
  let recommendations = [];

  let targetMin = 20;
  let ventDurationText = '20 Min';
  
  if (outside.temp < 5) { targetMin = 5; ventDurationText = '5-10 Min (Stoßlüften)'; }
  else if (outside.temp < 10) { targetMin = 10; ventDurationText = '10-15 Min'; }
  else if (outside.temp < 20) { targetMin = 20; ventDurationText = '15-20 Min'; }
  else { targetMin = 30; ventDurationText = '> 25 Min'; }

  if (room.temp < limits.tempMin) {
    score -= 20;
    issues.push({ type: 'temp', status: 'low', msg: 'Zu kalt' });
    if (!room.windowOpen) recommendations.push('Heizung prüfen');
  } else if (room.temp > limits.tempMax) {
    score -= 20;
    issues.push({ type: 'temp', status: 'high', msg: 'Zu warm' });
    recommendations.push('Heizung runterdrehen');
  }

  const dewPointInside = calculateDewPoint(room.temp, room.humidity);
  const dewPointOutside = calculateDewPoint(outside.temp, outside.humidity);

  if (room.humidity < limits.humMin) {
    score -= 15;
    issues.push({ type: 'hum', status: 'low', msg: 'Trockene Luft' });
    recommendations.push('Luftbefeuchter nutzen oder Wäsche im Raum trocknen');
  } else if (room.humidity > limits.humMax) {
    score -= 30;
    issues.push({ type: 'hum', status: 'high', msg: 'Hohe Feuchte' });
    
    if (dewPointOutside < dewPointInside) {
      if (room.windowOpen && room.lastWindowOpen) {
          const diffMs = Date.now() - new Date(room.lastWindowOpen).getTime();
          const openMin = diffMs / 60000;
          const remaining = Math.ceil(targetMin - openMin);
          
          if (remaining > 0) {
             recommendations.push(`Noch ca. ${remaining} Min. lüften`);
          } else {
             recommendations.push(`Genug gelüftet! Fenster schließen.`);
          }
      } else {
          recommendations.push(`Lüften empfohlen: ${ventDurationText}`);
          if (room.hasVentilation) {
            recommendations.push('Falls möglich: Lüftung prüfen/aktivieren');
          }
      }
    } else {
      recommendations.push('Lüften momentan ineffektiv (Draußen zu feucht)');
    }
  }

  if (room.hasCo2 && room.co2) {
    if (room.co2 > 1000) {
       const isCrit = room.co2 >= 1500;
       score -= isCrit ? 50 : 20;
       issues.push({ type: 'co2', status: isCrit ? 'crit' : 'warn', msg: isCrit ? 'Luftqualität schlecht' : 'CO2 erhöht' });
       
       if (room.windowOpen && room.lastWindowOpen) {
          const diffMs = Date.now() - new Date(room.lastWindowOpen).getTime();
          const openMin = diffMs / 60000;
          const remaining = Math.ceil(targetMin - openMin);
          
          if (remaining > 0) {
             recommendations.push(`CO2 senken: Noch ${remaining} Min. offen lassen`);
          } else {
             recommendations.push(`Luft sollte frisch sein. Fenster schließen.`);
          }
       } else {
          recommendations.push(isCrit ? `Fenster sofort öffnen! (mind. ${ventDurationText})` : `Stoßlüften für ca. ${ventDurationText}`);
          if (room.hasVentilation) {
            recommendations.push('Zusätzlich Lüftung nutzen?');
          }
       }
    }
  }

  const isVentilating = recommendations.some(r => r.includes('Noch') && r.includes('lüften'));
  
  if (room.windowOpen && room.temp < limits.tempMin && !isVentilating) {
    recommendations.push('Wärmeverlust: Fenster schließen');
  }

  return {
    score: Math.max(0, score),
    issues,
    recommendations,
    dewPoint: dewPointInside.toFixed(1)
  };
};

const formatTimeAgo = (dateString) => {
  if (!dateString) return 'Unbekannt';
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  
  if (minutes < 1) return 'Gerade eben';
  if (minutes < 60) return `${minutes} min`;
  if (hours < 24) return `${hours} h`;
  return '> 1 Tag';
};

// --- DATA HOOK (THE BRAIN) ---

const useHomeAssistant = () => {
  const [rooms, setRooms] = useState(INITIAL_ROOMS);
  const [outside, setOutside] = useState(OUTSIDE_DATA);
  const [isDemoMode, setIsDemoMode] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [errorMessage, setErrorMessage] = useState('');
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const fetchData = async () => {
    // Wenn keine Credentials da sind, direkt Demo Modus
    if (!HA_URL || !HA_TOKEN) {
      setIsDemoMode(true);
      simulateDataChange();
      return;
    }

    // SICHERHEITSCHECK: Mixed Content
    const isAppHttps = window.location.protocol === 'https:';
    const isHaHttp = HA_URL.startsWith('http://');
    
    if (isAppHttps && isHaHttp) {
        setConnectionStatus('error');
        setErrorMessage('Sicherheitsblockade: Die App läuft auf HTTPS, aber Home Assistant auf HTTP. Der Browser blockiert diese unsichere Verbindung ("Mixed Content"). Bitte nutze die Nabu Casa URL (https) oder SSL.');
        return;
    }

    try {
      setIsDemoMode(false);
      setConnectionStatus('loading');
      setErrorMessage('');
      
      const response = await fetch(`${HA_URL}/api/states`, {
        headers: {
          'Authorization': `Bearer ${HA_TOKEN}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP Fehler: ${response.status} ${response.statusText}`);
      }
      
      const states = await response.json();
      setConnectionStatus('connected');
      setLastUpdate(new Date());

      const getNum = (id) => {
        const entity = states.find(s => s.entity_id === id);
        return entity && !isNaN(entity.state) ? parseFloat(entity.state) : null;
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
        if (!map) return room;

        const windowSensor = states.find(s => s.entity_id === map.window);
        const windowOpen = windowSensor ? windowSensor.state === 'on' : false;
        
        let lastOpen = room.lastWindowOpen;
        
        if (windowOpen && windowSensor) {
            lastOpen = windowSensor.last_changed;
        } else if (!windowOpen) {
            lastOpen = null; 
        }

        return {
          ...room,
          temp: getNum(map.temp) || room.temp,
          humidity: getNum(map.humidity) || room.humidity,
          co2: map.co2 ? getNum(map.co2) : room.co2,
          windowOpen: windowOpen,
          lastWindowOpen: lastOpen
        };
      }));

    } catch (error) {
      console.error("HA Fetch Error:", error);
      setConnectionStatus('error');
      
      let userMsg = error.message;
      if (error.message.includes('Failed to fetch')) {
          userMsg = 'Netzwerkfehler (CORS Blockade). Die App darf nicht auf Home Assistant zugreifen. Bitte prüfe die "cors_allowed_origins" in der configuration.yaml.';
      }
      setErrorMessage(userMsg);
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

  return { rooms, outside, isDemoMode, connectionStatus, errorMessage, refresh: fetchData, enableDemoMode };
};

// --- COMPONENTS ---

const M3Chip = ({ icon: Icon, label, active = false, onClick }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all
      ${active 
        ? 'bg-blue-100 text-blue-900 border border-blue-200' 
        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
      }`}
  >
    {Icon && <Icon size={16} />}
    {label}
  </button>
);

const M3StatCard = ({ icon: Icon, label, value, subValue, theme = 'primary', onClick }) => {
  const themes = {
    primary: 'bg-blue-50 text-blue-900',
    secondary: 'bg-indigo-50 text-indigo-900',
    tertiary: 'bg-orange-50 text-orange-900',
    neutral: 'bg-gray-100 text-gray-900'
  };
  
  return (
    <div 
      onClick={onClick}
      className={`p-5 rounded-3xl flex flex-col justify-between h-32 ${themes[theme]} transition-all hover:scale-[1.02] ${onClick ? 'cursor-pointer hover:shadow-md' : ''}`}
    >
      <div className="flex justify-between items-start">
        <Icon size={24} className="opacity-80"/>
        <span className="text-3xl font-normal">{value}</span>
      </div>
      <div>
        <div className="text-sm font-medium opacity-70">{label}</div>
        <div className="text-xs opacity-60 mt-1">{subValue}</div>
      </div>
    </div>
  );
};

const RoomCardM3 = ({ room, outsideData, onClick }) => {
  const analysis = useMemo(() => analyzeRoom(room, outsideData), [room, outsideData]);
  
  let containerClass = "bg-white border-transparent";
  let scoreBadgeClass = "bg-green-100 text-green-800";
  
  if (analysis.score < 80) { 
    containerClass = "bg-yellow-50 border-yellow-100";
    scoreBadgeClass = "bg-yellow-200 text-yellow-900"; 
  }
  if (analysis.score < 60) { 
    containerClass = "bg-red-50 border-red-100"; 
    scoreBadgeClass = "bg-red-200 text-red-900";
  }

  const countdownMsg = analysis.recommendations.find(r => r.includes('Noch') && r.includes('Min'));

  return (
    <div 
      onClick={onClick}
      className={`group relative p-5 rounded-[24px] transition-all cursor-pointer hover:shadow-md border ${containerClass} ${room.windowOpen ? 'ring-2 ring-blue-300 ring-offset-2' : ''}`}
    >
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
           <div className={`w-10 h-10 rounded-full flex items-center justify-center ${analysis.score < 60 ? 'bg-red-200 text-red-900' : 'bg-blue-50 text-blue-700'}`}>
             <Home size={20} />
           </div>
           <div>
              <h3 className="font-medium text-lg text-gray-800 leading-tight">{room.name}</h3>
              <p className="text-xs text-gray-500 flex items-center gap-2">
                {room.windowOpen ? 'Fenster offen' : 'Geschlossen'}
                {room.hasVentilation && <Fan size={12} className="text-gray-400" title="Lüftung vorhanden"/>}
              </p>
           </div>
        </div>
        <div className={`px-3 py-1 rounded-full text-sm font-bold ${scoreBadgeClass}`}>
          {analysis.score}
        </div>
      </div>

      <div className="flex gap-4 mb-2">
        <div className="flex-1 bg-white/60 p-3 rounded-2xl">
           <div className="text-xs text-gray-500 mb-1">Temp</div>
           <div className="text-xl font-normal text-gray-800">{room.temp.toFixed(1)}°</div>
        </div>
        <div className="flex-1 bg-white/60 p-3 rounded-2xl">
           <div className="text-xs text-gray-500 mb-1">Feuchte</div>
           <div className={`text-xl font-normal ${analysis.issues.some(i => i.type === 'hum') ? 'text-red-700' : 'text-gray-800'}`}>
             {room.humidity}%
           </div>
        </div>
      </div>

      {analysis.recommendations.length > 0 && (
         <div className={`mt-3 flex items-start gap-2 text-xs p-2 rounded-lg ${countdownMsg ? 'bg-blue-100 text-blue-800 font-bold' : 'bg-white/50 text-gray-600'}`}>
            {countdownMsg ? <Timer size={14} className="mt-0.5 shrink-0"/> : <AlertCircle size={14} className="mt-0.5 shrink-0 text-orange-600"/>}
            <span className="line-clamp-1">{countdownMsg || analysis.recommendations[0]}</span>
         </div>
      )}
      
      <div className="absolute top-4 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="p-2 rounded-full hover:bg-black/5 text-gray-400">
             <ArrowUpRight size={20} />
          </button>
      </div>
    </div>
  );
};

const M3Modal = ({ room, outsideData, onClose }) => {
  if (!room) return null;
  const analysis = useMemo(() => analyzeRoom(room, outsideData), [room, outsideData]);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#fefefe] rounded-[28px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="p-6 pb-2 flex justify-between items-start">
           <div>
             <h2 className="text-3xl font-normal text-gray-900">{room.name}</h2>
             <p className="text-gray-500 mt-1 flex items-center gap-1">
                {room.type === 'living' ? 'Wohnbereich' : room.type === 'sleeping' ? 'Ruhebereich' : 'Funktionsraum'}
             </p>
           </div>
           <button onClick={onClose} className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
             <X size={20} className="text-gray-700"/>
           </button>
        </div>

        <div className="p-6 pt-4 overflow-y-auto">
          <div className={`mb-6 p-4 rounded-3xl flex items-center gap-4 ${analysis.score >= 80 ? 'bg-green-50 text-green-900' : analysis.score >= 60 ? 'bg-yellow-50 text-yellow-900' : 'bg-red-50 text-red-900'}`}>
             <div className="text-4xl font-medium">{analysis.score}</div>
             <div className="text-sm opacity-80 border-l border-current pl-4 leading-tight">
               Gesamt-<br/>Komfortindex
             </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
             <div className="bg-surface-variant p-4 rounded-2xl bg-gray-50">
                <div className="flex items-center gap-2 text-gray-500 text-sm mb-1"><Thermometer size={16}/> Temperatur</div>
                <div className="text-2xl text-gray-800">{room.temp}°C</div>
                <div className="text-xs text-gray-400 mt-1">Soll: {COMFORT_RANGES[room.type]?.tempMin}-{COMFORT_RANGES[room.type]?.tempMax}°</div>
             </div>
             
             <div className="bg-surface-variant p-4 rounded-2xl bg-gray-50">
                <div className="flex items-center gap-2 text-gray-500 text-sm mb-1"><Droplets size={16}/> Feuchte</div>
                <div className="text-2xl text-gray-800">{room.humidity}%</div>
                <div className="text-xs text-gray-400 mt-1">Taupunkt: {analysis.dewPoint}°</div>
             </div>

             {room.hasCo2 && (
               <div className="col-span-2 bg-surface-variant p-4 rounded-2xl bg-gray-50 flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-1"><Wind size={16}/> CO2 Belastung</div>
                    <div className="text-2xl text-gray-800">{room.co2} ppm</div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold ${room.co2 < 1000 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                     {room.co2 < 1000 ? 'Gut' : 'Schlecht'}
                  </div>
               </div>
             )}
          </div>

          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Maßnahmen</h3>
          <div className="space-y-3">
             {analysis.recommendations.length > 0 ? analysis.recommendations.map((rec, i) => (
                <div key={i} className={`flex gap-4 p-4 rounded-2xl items-start ${rec.includes('Noch') ? 'bg-blue-100 text-blue-900' : 'bg-blue-50 text-blue-900'}`}>
                   <div className="bg-white/50 p-2 rounded-full shrink-0">
                      {rec.includes('Noch') ? <Timer size={18} className="text-blue-700"/> : <Activity size={18} className="text-blue-700"/>}
                   </div>
                   <div>
                      <div className="font-medium text-sm">{rec}</div>
                      <div className="text-xs opacity-70 mt-1">{rec.includes('Noch') ? 'Aktiver Timer' : 'Handlung empfohlen'}</div>
                   </div>
                </div>
             )) : (
               <div className="flex gap-4 p-4 rounded-2xl bg-green-50 text-green-900 items-center">
                  <CheckCircle size={24} />
                  <span className="font-medium text-sm">Perfektes Klima. Keine Maßnahmen nötig.</span>
               </div>
             )}
          </div>

           <div className="mt-6 pt-6 border-t border-gray-100 space-y-4">
              {room.hasWindow && (
                <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Fensterstatus</span>
                    <div className="flex items-center gap-2">
                      {room.windowOpen ? (
                        <span className="flex items-center gap-2 text-blue-600 font-medium px-3 py-1 bg-blue-50 rounded-full">
                          <Wind size={14}/> Offen
                        </span>
                      ) : (
                        <span className="text-gray-400">Geschlossen</span>
                      )}
                      {!room.windowOpen && room.lastWindowOpen && (
                        <span className="text-gray-400 text-xs">
                          ({formatTimeAgo(room.lastWindowOpen)})
                        </span>
                      )}
                    </div>
                </div>
              )}
              {room.hasVentilation && (
                <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Raumlüftung</span>
                    <div className="flex items-center gap-2 text-gray-600 px-3 py-1 bg-gray-100 rounded-full">
                       <Fan size={14} className="text-gray-500"/>
                       <span className="font-medium">Vorhanden (Manuell)</span>
                    </div>
                </div>
              )}
           </div>

        </div>
        
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
           <button onClick={onClose} className="px-6 py-2.5 rounded-full bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors shadow-sm">
             Fertig
           </button>
        </div>

      </div>
    </div>
  );
};

const WindowListModal = ({ rooms, onClose }) => {
  const openWindows = rooms.filter(r => r.windowOpen);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#fefefe] rounded-[28px] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 p-6">
        <div className="flex justify-between items-center mb-4">
           <h3 className="text-xl font-normal text-gray-900">Fensterstatus</h3>
           <button onClick={onClose} className="p-2 rounded-full bg-gray-100 hover:bg-gray-200">
             <X size={20} className="text-gray-700"/>
           </button>
        </div>
        
        <div className="space-y-3">
          {openWindows.length > 0 ? (
            openWindows.map(room => (
              <div key={room.id} className="flex items-center gap-3 p-4 bg-blue-50 text-blue-900 rounded-2xl">
                 <div className="bg-blue-100 p-2 rounded-full">
                    <Wind size={20} className="text-blue-700"/>
                 </div>
                 <div>
                   <span className="font-medium block">{room.name}</span>
                   <span className="text-xs opacity-70">Fenster geöffnet</span>
                 </div>
              </div>
            ))
          ) : (
             <div className="flex flex-col items-center py-8 text-green-700 bg-green-50 rounded-2xl border border-green-100">
                <CheckCircle size={40} className="mb-3 opacity-80"/>
                <span className="font-medium text-lg">Alle geschlossen</span>
                <span className="text-sm opacity-70">Kein Fenster ist aktuell geöffnet</span>
             </div>
          )}
        </div>
        
        <div className="mt-6 flex justify-end">
           <button onClick={onClose} className="px-5 py-2 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors">
             Schließen
           </button>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const { rooms, outside, isDemoMode, connectionStatus, errorMessage, refresh, enableDemoMode } = useHomeAssistant();
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showWindowModal, setShowWindowModal] = useState(false);
  const [filter, setFilter] = useState('all'); 

  const avgTemp = (rooms.reduce((acc, r) => acc + r.temp, 0) / rooms.length).toFixed(1);
  const openWindows = rooms.filter(r => r.windowOpen).length;
  
  const filteredRooms = filter === 'all' 
    ? rooms 
    : rooms.filter(r => analyzeRoom(r, outside).score < 80);

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-gray-900 font-sans p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-normal text-gray-900 tracking-tight">Raumluftkomfort</h1>
            <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
               {isDemoMode ? (
                 <span className="flex items-center gap-1 bg-gray-200 px-2 py-0.5 rounded text-gray-700"><WifiOff size={12}/> Demo Modus</span>
               ) : (
                 <span className={`flex items-center gap-1 px-2 py-0.5 rounded ${connectionStatus === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                   {connectionStatus === 'error' ? <AlertTriangle size={12}/> : <Wifi size={12}/>} 
                   {connectionStatus === 'connected' ? 'Verbunden' : 'Verbindungsfehler'}
                 </span>
               )}
            </div>
          </div>
          
          <div className="flex gap-2">
            {connectionStatus === 'error' && (
              <button 
                onClick={enableDemoMode}
                className="bg-yellow-100 text-yellow-900 p-4 rounded-2xl hover:bg-yellow-200 transition-colors active:scale-95 flex items-center gap-2 font-medium text-sm"
              >
                In Demo-Modus wechseln
              </button>
            )}
            <button 
              onClick={refresh}
              className="bg-blue-100 text-blue-900 p-4 rounded-2xl hover:bg-blue-200 transition-colors active:scale-95 flex items-center justify-center"
              title="Aktualisieren"
            >
              <RefreshCw size={24} className={connectionStatus === 'loading' ? 'animate-spin' : ''}/>
            </button>
          </div>
        </header>

        {connectionStatus === 'error' && errorMessage && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-800 animate-in fade-in slide-in-from-top-2">
             <div className="bg-red-100 p-2 rounded-full shrink-0 mt-0.5">
               {errorMessage.includes('Sicherheitsblockade') ? <Lock size={20}/> : <AlertTriangle size={20}/>}
             </div>
             <div>
               <h3 className="font-bold">Verbindung zu Home Assistant fehlgeschlagen</h3>
               <p className="text-sm mt-1 mb-2">{errorMessage}</p>
               <div className="text-xs bg-white/50 p-3 rounded-lg border border-red-100/50">
                 <strong>Tipp:</strong> In dieser Vorschau funktionieren direkte Verbindungen oft nicht (CORS/HTTPS). 
                 Nutze den "Demo-Modus" Button oben, um das Design zu testen. 
                 Echte Daten funktionieren später, wenn du die App auf Vercel oder lokal hostest.
               </div>
             </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
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
            theme={openWindows > 0 ? 'tertiary' : 'neutral'}
            onClick={() => setShowWindowModal(true)}
          />
          <div className="bg-emerald-50 text-emerald-900 p-5 rounded-3xl flex flex-col justify-between h-32">
             <div className="flex justify-between items-start">
                <Activity size={24} className="opacity-80"/>
                <span className="text-3xl font-normal">Gut</span>
             </div>
             <div>
               <div className="text-sm font-medium opacity-70">Status</div>
               <div className="text-xs opacity-60 mt-1">Gesamtwertung</div>
             </div>
          </div>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <M3Chip label="Alle Räume" active={filter === 'all'} onClick={() => setFilter('all')} />
          <M3Chip label="Handlung nötig" icon={AlertCircle} active={filter === 'attention'} onClick={() => setFilter('attention')} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredRooms.map(room => (
            <RoomCardM3 
              key={room.id} 
              room={room} 
              outsideData={outside}
              onClick={() => setSelectedRoom(room)}
            />
          ))}
        </div>
        
        {filteredRooms.length === 0 && (
           <div className="text-center py-20 text-gray-400">
              <CheckCircle size={48} className="mx-auto mb-4 opacity-20"/>
              <p>Keine Räume entsprechen diesem Filter.</p>
           </div>
        )}

        <div className="mt-16 text-center text-sm text-gray-400 pb-8">
          Home Assistant Integration v1.2 • Material Design 3
        </div>

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
