import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Settings, Search, Plus, Edit, Save, 
  CheckCircle, Gift, Trophy, Camera, Star, ShieldCheck, 
  LogOut, CheckSquare, BarChart3, MessageCircle, AlertCircle, 
  Calendar, Phone, ChevronRight, Printer, Cake, Bell, UserCircle, CloudOff, Lock
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

// ==========================================
// Custom Icons & Utilities
// ==========================================
const ChaliceIcon = ({ active, className = "w-7 h-7" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M6 3h12l-1 6c0 2.76-2.24 5-5 5s-5-2.24-5-5L6 3z" />
    <path d="M12 14v7" />
    <path d="M8 21h8" />
  </svg>
);

const compressImage = (file, callback) => {
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_SIZE = 250; 
      let width = img.width, height = img.height;
      if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } } 
      else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      callback(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
};

// ==========================================
// 1. Initial Data Setup
// ==========================================
const TODAY = new Date().toISOString().split('T')[0];
const STORAGE_KEY = 'sunday_school_live_v3'; 

const createStudent = (id, name) => ({ id, name, phone: '', dob: '', notes: '', active: true, visitationLog: [], avatar: '' });

const INITIAL_STUDENTS = [
  createStudent('1', 'أَنْجِيلِيَا نَسِيم'), createStudent('2', 'بَتُول أَبَاؤُب'),
  createStudent('3', 'بَتُول بُولَا'), createStudent('4', 'بِيشُوي هَانِي مَاهِر'),
  createStudent('5', 'تُونِي هَانِي'), createStudent('6', 'تُومَاس مِينَا'),
  createStudent('7', 'جُونِير هَانِي'), createStudent('8', 'سَعِيد مَاهِر'),
  createStudent('9', 'شِنُودَة رُومَانِي'), createStudent('10', 'عِمَاد جِرْجِس'),
  createStudent('11', 'فِيلُوبَاتِير عَادِل'), createStudent('12', 'كَارْس رِضَا'),
  createStudent('13', 'كَاتْرِين رِضَا'), createStudent('14', 'كِيرِلُّس جُوزِيف'),
  createStudent('15', 'مَارُونِيَا مِينَا'), createStudent('16', 'مَتَّاؤُس صُبْحِي'),
  createStudent('17', 'مَرْيَم مِيلَاد'), createStudent('18', 'مِهْرَائِيل بَدِير'),
  createStudent('19', 'مِيرَاي مِينَا'), createStudent('20', 'مِينَا مَجْدِي سِرْيَال'),
  createStudent('21', 'نَارْدِين القِسّ غَبْرِيَال'), createStudent('22', 'نُوفِير مَجْدِي'),
  createStudent('23', 'يُونَان مَلَاك'),
];

const DEFAULT_SETTINGS = {
  className: 'الصف الثالث الابتدائي', classImage: '', darkMode: false,
  soundEnabled: true, hapticEnabled: true, adminPin: '0000', servantPin: '1234',
  bigPrizePoints: 8, smallPrizePoints: 4, cycleStartDate: '2024-01-01' 
};

// --- Firebase Setup ---
// 🔴 ضع هنا إعدادات Firebase الخاصة بك
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "12345",
  appId: "1:12345:web:abcdef"
};

let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) { console.warn("Firebase Init Skipped, working offline"); }

// ==========================================
// 2. Main Application Component
// ==========================================
export default function App() {
  const [userRole, setUserRole] = useState(null); 
  const [pinInput, setPinInput] = useState('');
  const [servantName, setServantName] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState('attendance'); 
  const [toast, setToast] = useState(null);
  const [user, setUser] = useState(null);
  const [cloudStatus, setCloudStatus] = useState('connecting');
  
  const [data, setData] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if(!parsed.settings) parsed.settings = DEFAULT_SETTINGS;
        parsed.students = parsed.students.map(s => ({...s, avatar: s.avatar || '', dob: s.dob || ''}));
        return parsed;
      }
    } catch(e) {}
    return { students: INITIAL_STUDENTS, records: {}, settings: DEFAULT_SETTINGS };
  });

  useEffect(() => {
    if (!auth) { setCloudStatus('offline'); return; }
    signInAnonymously(auth).catch(() => setCloudStatus('offline'));
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) setUser(u); else setCloudStatus('offline');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    const docRef = doc(db, 'sundaySchool', 'mainState');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) setData(docSnap.data());
      setCloudStatus('online');
    }, (err) => {
      console.warn("Cloud offline fallback", err);
      setCloudStatus('offline');
    });
    return () => unsubscribe();
  }, [user]);

  const updateData = (newDataFunction) => {
    setData(prev => {
      const newData = typeof newDataFunction === 'function' ? newDataFunction(prev) : newDataFunction;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newData)); } catch(e) {
        if(e.name === 'QuotaExceededError') alert('مساحة التخزين ممتلئة! قلل حجم الصور.');
      }
      if (user && db && cloudStatus === 'online') {
        setDoc(doc(db, 'sundaySchool', 'mainState'), newData).catch(() => setCloudStatus('offline'));
      }
      return newData;
    });
  };

  useEffect(() => {
    if (data.settings?.darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [data.settings?.darkMode]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 2500);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (!servantName.trim()) return setLoginError('يرجى إدخال اسم الخادم لتسجيل العمليات.');
    if (pinInput === data.settings?.adminPin) { setUserRole('admin'); setLoginError(''); } 
    else if (pinInput === data.settings?.servantPin) { setUserRole('servant'); setLoginError(''); } 
    else setLoginError('الرمز السري غير صحيح');
  };

  const activeStudents = data.students?.filter(s => s.active) || [];
  const todayRecord = data.records?.[TODAY] || {};

  // Print PDF View Component
  const PrintView = () => (
    <div className="hidden print:block bg-white text-black p-8 font-sans w-full" dir="rtl" id="print-area">
      <div className="flex items-center border-b-2 border-gray-800 pb-6 mb-6">
        {data.settings?.classImage && <img src={data.settings.classImage} className="w-20 h-20 rounded-full border-2 border-gray-800 ml-4" />}
        <div className="flex-1">
          <h1 className="text-3xl font-black text-gray-900">{data.settings?.className}</h1>
          <h2 className="text-lg font-bold text-gray-600">تقرير خدمة مدارس الأحد</h2>
        </div>
        <div className="text-left">
          <p className="font-bold">التاريخ: <span className="font-normal" dir="ltr">{TODAY}</span></p>
          <p className="font-bold">بواسطة: <span className="font-normal">{servantName}</span></p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-8 text-center">
        <div className="p-4 border-2 border-gray-300 rounded-xl"><p className="text-sm font-bold text-gray-500">الكل</p><p className="text-2xl font-black">{activeStudents.length}</p></div>
        <div className="p-4 border-2 border-gray-300 rounded-xl"><p className="text-sm font-bold text-gray-500">حضور اليوم</p><p className="text-2xl font-black text-green-700">{Object.values(todayRecord).filter(r => r.present).length}</p></div>
        <div className="p-4 border-2 border-gray-300 rounded-xl"><p className="text-sm font-bold text-gray-500">غياب اليوم</p><p className="text-2xl font-black text-red-700">{activeStudents.length - Object.values(todayRecord).filter(r => r.present).length}</p></div>
      </div>
      <h3 className="text-xl font-bold mb-3 border-b pb-1 text-red-700">سجل الغياب</h3>
      <table className="w-full text-right border-collapse border border-gray-300 mb-8">
        <thead><tr className="bg-gray-100"><th className="border p-2">الاسم</th><th className="border p-2">الهاتف</th><th className="border p-2">ملاحظات</th></tr></thead>
        <tbody>
          {activeStudents.filter(s => !todayRecord[s.id]?.present).map(s => (
            <tr key={s.id}><td className="border p-2 font-bold">{s.name}</td><td className="border p-2 font-mono">{s.phone||'-'}</td><td className="border p-2">{s.notes||'-'}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (!userRole) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
        <div className="w-full max-w-md p-8 rounded-3xl shadow-2xl bg-white dark:bg-gray-800">
          <div className="text-center mb-8">
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg mx-auto mb-4 bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              {data.settings?.classImage ? <img src={data.settings.classImage} className="w-full h-full object-cover" /> : <ShieldCheck className="w-12 h-12 text-white" />}
            </div>
            <h1 className="text-2xl font-bold mb-1">{data.settings?.className || 'فصل الخدمة'}</h1>
            <p className="text-gray-500 text-sm">بوابة الخدام</p>
            <p className="text-xs text-blue-500 mt-2 font-mono">الأدمن: 0000 | الخادم: 1234</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <UserCircle className="absolute right-4 top-4 text-gray-400 w-6 h-6"/>
              <input type="text" value={servantName} onChange={(e) => setServantName(e.target.value)}
                className="w-full pl-4 pr-12 py-4 rounded-2xl border-2 outline-none font-bold bg-gray-50 dark:bg-gray-700 dark:border-gray-600 focus:border-blue-500" placeholder="اسم الخادم (مهم للتقارير)" />
            </div>
            <div className="relative">
              <Lock className="absolute right-4 top-4 text-gray-400 w-6 h-6"/>
              <input type="password" inputMode="numeric" value={pinInput} onChange={(e) => setPinInput(e.target.value)}
                className="w-full pl-4 pr-12 py-4 rounded-2xl border-2 outline-none tracking-widest font-bold bg-gray-50 dark:bg-gray-700 dark:border-gray-600 focus:border-blue-500" placeholder="الرمز السري" />
            </div>
            {loginError && <p className="text-red-500 text-center text-sm font-semibold">{loginError}</p>}
            {cloudStatus === 'offline' && <p className="text-[10px] text-orange-500 text-center flex justify-center items-center gap-1 mt-2"><CloudOff className="w-3 h-3"/> يعمل محلياً (بدون سحابة)</p>}
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg active:scale-95 text-lg transition-all mt-2">دخول للخدمة</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
    <PrintView />
    <div className="min-h-screen pb-24 transition-colors duration-200 print:hidden bg-slate-50 text-slate-900 dark:bg-gray-900 dark:text-white font-sans select-none overflow-x-hidden relative">
      {toast && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in">
          <div className={`px-6 py-3 rounded-full shadow-lg font-bold text-sm flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-gray-800 text-white'}`}>
            {toast.type === 'success' ? <CheckCircle className="w-5 h-5"/> : <AlertCircle className="w-5 h-5"/>} {toast.msg}
          </div>
        </div>
      )}
      <header className="sticky top-0 z-30 px-4 py-3 shadow-sm flex flex-col gap-3 bg-white dark:bg-gray-800 border-b dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-blue-100 flex items-center justify-center border-2 border-white shadow-sm shrink-0">
              {data.settings?.classImage ? <img src={data.settings.classImage} className="w-full h-full object-cover" /> : <Users className="w-6 h-6 text-blue-500" />}
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight truncate max-w-[180px]">{data.settings?.className}</h1>
              <p className="text-[11px] text-gray-500 flex items-center gap-1">الخادم: {servantName} {cloudStatus === 'offline' && <CloudOff className="w-3 h-3 text-orange-500"/>}</p>
            </div>
          </div>
          <button onClick={() => {setUserRole(null); setPinInput(''); setServantName('');}} className="p-2 rounded-full text-red-500 bg-red-50 dark:bg-red-900/20 hover:bg-red-100"><LogOut className="w-5 h-5" /></button>
        </div>
      </header>
      <main className="p-4 max-w-2xl mx-auto">
        {activeTab === 'attendance' && <QuickAttendance data={data} updateData={updateData} activeStudents={activeStudents} todayRecord={todayRecord} showToast={showToast} servantName={servantName} />}
        {activeTab === 'dashboard' && <DashboardTab data={data} activeStudents={activeStudents} todayRecord={todayRecord} />}
        {activeTab === 'prizes' && <PrizesTab data={data} activeStudents={activeStudents} />}
        {activeTab === 'students' && userRole === 'admin' && <StudentsTab data={data} updateData={updateData} showToast={showToast} servantName={servantName} />}
        {activeTab === 'settings' && userRole === 'admin' && <SettingsTab data={data} updateData={updateData} showToast={showToast} servantName={servantName} />}
      </main>
      <nav className="fixed bottom-0 w-full flex justify-around shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.1)] z-40 pb-safe bg-white dark:bg-gray-800 border-t dark:border-gray-700">
        <TabBtn id="attendance" icon={CheckSquare} label="الخدمة" activeTab={activeTab} setActiveTab={setActiveTab} />
        <TabBtn id="dashboard" icon={BarChart3} label="إحصائيات" activeTab={activeTab} setActiveTab={setActiveTab} />
        <TabBtn id="prizes" icon={Gift} label="الجوائز" activeTab={activeTab} setActiveTab={setActiveTab} />
        {userRole === 'admin' && (
          <>
            <TabBtn id="students" icon={Users} label="الأطفال" activeTab={activeTab} setActiveTab={setActiveTab} />
            <TabBtn id="settings" icon={Settings} label="الإعدادات" activeTab={activeTab} setActiveTab={setActiveTab} />
          </>
        )}
      </nav>
    </div>
    </>
  );
}

const TabBtn = ({ id, icon: Icon, label, activeTab, setActiveTab }) => {
  const isActive = activeTab === id;
  return (
    <button onClick={() => setActiveTab(id)} className={`flex flex-col items-center justify-center w-full py-3 transition-all ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 hover:text-gray-500'}`}>
      <div className={`relative p-1 ${isActive ? 'bg-blue-50 dark:bg-blue-900/30 rounded-xl' : ''}`}><Icon className={`w-6 h-6 ${isActive ? 'scale-110' : ''}`} /></div>
      <span className={`text-[10px] mt-1 font-bold ${isActive ? 'opacity-100' : 'opacity-70'}`}>{label}</span>
    </button>
  );
};

function QuickAttendance({ data, updateData, activeStudents, todayRecord, showToast, servantName }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');

  const handleAction = (studentId, studentName, actionType) => {
    updateData(prev => {
      const currentRecord = prev.records[TODAY]?.[studentId] || { present: false, communion: false, bonus: false };
      let newRecord = { ...currentRecord, recordedBy: servantName };
      if (actionType === 'present') {
        newRecord.present = !newRecord.present;
        if (!newRecord.present) { newRecord.communion = false; newRecord.bonus = false; }
        if (newRecord.present) showToast(`تم حضور: ${studentName}`);
      } else if (actionType === 'communion') {
        newRecord.communion = !newRecord.communion;
        if (newRecord.communion) newRecord.present = true;
      } else if (actionType === 'bonus') {
        newRecord.bonus = !newRecord.bonus;
        if (newRecord.bonus) newRecord.present = true;
      }
      return { ...prev, records: { ...(prev.records || {}), [TODAY]: { ...((prev.records || {})[TODAY] || {}), [studentId]: newRecord } } };
    });
  };

  let displayList = activeStudents.filter(s => s.name.includes(searchTerm));
  if (filter === 'present') displayList = displayList.filter(s => todayRecord[s.id]?.present);
  if (filter === 'absent') displayList = displayList.filter(s => !todayRecord[s.id]?.present);

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex justify-between items-center text-sm font-semibold bg-blue-50 dark:bg-gray-800 border border-blue-100 dark:border-gray-700 rounded-2xl p-3 shadow-sm">
        <div className="flex flex-col items-center flex-1 border-l border-gray-200 dark:border-gray-600"><span className="text-gray-500 text-[10px]">الكل</span><span>{activeStudents.length}</span></div>
        <div className="flex flex-col items-center flex-1 border-l border-gray-200 dark:border-gray-600 text-green-600"><span className="text-[10px]">حضور</span><span>{Object.values(todayRecord).filter(r => r.present).length}</span></div>
        <div className="flex flex-col items-center flex-1 border-l border-gray-200 dark:border-gray-600 text-orange-600"><span className="text-[10px]">تناول</span><span>{Object.values(todayRecord).filter(r => r.communion).length}</span></div>
        <div className="flex flex-col items-center flex-1 text-yellow-600"><span className="text-[10px]">نقاط ⭐</span><span>{Object.values(todayRecord).filter(r => r.bonus).length}</span></div>
      </div>

      <div className="sticky top-[70px] z-20 space-y-2 backdrop-blur-md pb-2 pt-1 -mx-4 px-4">
        <div className="relative">
          <Search className="w-6 h-6 absolute right-3 top-3.5 text-gray-400" />
          <input type="text" placeholder="بحث سريع..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-4 pr-12 py-4 rounded-2xl border-2 outline-none focus:border-blue-500 font-bold shadow-sm bg-white dark:bg-gray-800 dark:border-gray-700" />
        </div>
        <div className="flex gap-2">
          {['all', 'present', 'absent'].map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`flex-1 py-2 rounded-xl font-bold text-sm ${filter === f ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
              {{all: 'الكل', present: 'حاضر', absent: 'غائب'}[f]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 mt-2 pb-8">
        {displayList.map(student => {
          const rec = todayRecord[student.id] || {};
          return (
            <div key={student.id} className={`flex items-center justify-between p-3 rounded-2xl border-2 transition-all ${rec.present ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800/50' : 'bg-white border-gray-100 dark:bg-gray-800 dark:border-gray-700'}`}>
              <div className="flex items-center flex-1 overflow-hidden gap-3">
                 <div className="w-12 h-12 rounded-full overflow-hidden bg-blue-100 dark:bg-gray-700 flex items-center justify-center text-blue-600 font-bold shrink-0 border border-gray-200 dark:border-gray-600">
                  {student.avatar ? <img src={student.avatar} className="w-full h-full object-cover" /> : student.name.split(' ')[0][0]}
                 </div>
                <h3 className={`font-bold text-base truncate ${rec.present ? 'text-green-700 dark:text-green-400' : ''}`}>{student.name}</h3>
              </div>
              <div className="flex gap-2 shrink-0 ml-2">
                <button onClick={() => handleAction(student.id, student.name, 'bonus')} className={`w-12 h-12 flex items-center justify-center rounded-2xl font-bold active:scale-90 ${rec.bonus ? 'bg-yellow-400 text-yellow-900 shadow-md ring-2 ring-yellow-400' : 'bg-gray-100 text-gray-300 dark:bg-gray-700'}`}><Star className="w-6 h-6"/></button>
                <button onClick={() => handleAction(student.id, student.name, 'communion')} className={`w-12 h-12 flex items-center justify-center rounded-2xl font-bold active:scale-90 ${rec.communion ? 'bg-orange-500 text-white shadow-md ring-2 ring-orange-500' : 'bg-gray-100 text-gray-400 dark:bg-gray-700'}`}><ChaliceIcon active={rec.communion} className="w-6 h-6" /></button>
                <button onClick={() => handleAction(student.id, student.name, 'present')} className={`w-14 h-12 flex items-center justify-center rounded-2xl font-bold active:scale-90 ${rec.present ? 'bg-green-500 text-white shadow-md ring-2 ring-green-500' : 'bg-gray-100 text-gray-400 dark:bg-gray-700'}`}><CheckCircle className="w-7 h-7" /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DashboardTab({ data, activeStudents, todayRecord }) {
  const [viewMode, setViewMode] = useState('chart'); 
  const availableDates = Object.keys(data.records || {}).sort((a,b) => new Date(b) - new Date(a));
  const [selectedDate, setSelectedDate] = useState(availableDates[0] || TODAY);

  const selectedRecord = data.records[selectedDate] || {};
  const presentStudents = activeStudents.filter(s => selectedRecord[s.id]?.present);
  const absentStudents = activeStudents.filter(s => !selectedRecord[s.id]?.present);

  const birthdayKids = activeStudents.filter(s => s.dob && new Date(s.dob).getMonth() === new Date().getMonth());
  
  const lastTwoDates = availableDates.slice(0, 2);
  const needsVisitKids = activeStudents.filter(s => {
    if (lastTwoDates.length < 2) return false;
    const absent1 = !data.records[lastTwoDates[0]]?.[s.id]?.present;
    const absent2 = !data.records[lastTwoDates[1]]?.[s.id]?.present;
    if (!absent1 || !absent2) return false; 
    const lastVisit = s.visitationLog?.[s.visitationLog.length - 1];
    if (!lastVisit) return true; 
    return ((new Date() - new Date(lastVisit.date)) / (1000 * 60 * 60 * 24)) > 14; 
  });

  const handleWhatsApp = (phone, name) => {
    if (!phone) return alert('لا يوجد رقم مسجل');
    let fPhone = phone.replace(/\\s+/g, '');
    if (fPhone.startsWith('01')) fPhone = '2' + fPhone;
    window.open(`https://wa.me/${fPhone}?text=${encodeURIComponent(`سلام ونعمة يا ${name}، افتقدناك جداً النهاردة في مدارس الأحد، يارب تكون بخير ⛪❤️`)}`, '_blank');
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex bg-gray-200 dark:bg-gray-800 p-1 rounded-xl">
        <button onClick={() => setViewMode('chart')} className={`flex-1 py-2 text-sm font-bold rounded-lg ${viewMode === 'chart' ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-700 dark:text-white' : 'text-gray-500'}`}>نظرة عامة</button>
        <button onClick={() => setViewMode('history')} className={`flex-1 py-2 text-sm font-bold rounded-lg ${viewMode === 'history' ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-700 dark:text-white' : 'text-gray-500'}`}>سجل الأيام</button>
      </div>

      {viewMode === 'chart' ? (
        <div className="space-y-6">
          {needsVisitKids.length > 0 && (
            <div className="p-4 rounded-3xl border shadow-sm bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800">
              <h2 className="font-bold text-red-600 dark:text-red-400 mb-3 flex items-center gap-2"><Bell className="w-5 h-5"/> يحتاجون لافتقاد عاجل</h2>
              <div className="space-y-2">
                {needsVisitKids.map(s => (
                  <div key={s.id} className="flex justify-between items-center text-sm font-semibold p-2 bg-white dark:bg-gray-800 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200">{s.avatar ? <img src={s.avatar} className="w-full h-full object-cover"/> : <Users className="w-4 h-4 m-2 text-gray-400"/>}</div>
                      <span>{s.name}</span>
                    </div>
                    <button onClick={() => handleWhatsApp(s.phone, s.name)} className="text-red-500 bg-red-100 p-2 rounded-lg"><MessageCircle className="w-4 h-4"/></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {birthdayKids.length > 0 && (
            <div className="p-4 rounded-3xl border shadow-sm bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
              <h2 className="font-bold text-blue-600 dark:text-blue-400 mb-3 flex items-center gap-2"><Cake className="w-5 h-5"/> أعياد ميلاد هذا الشهر 🎂</h2>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {birthdayKids.map(s => (
                  <div key={s.id} className="min-w-[100px] flex flex-col items-center bg-white dark:bg-gray-800 p-3 rounded-2xl shadow-sm text-center">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 mb-2 border-2 border-blue-200">{s.avatar ? <img src={s.avatar} className="w-full h-full object-cover"/> : <Users className="w-6 h-6 m-3 text-blue-200"/>}</div>
                    <span className="font-bold text-xs truncate w-full">{s.name.split(' ')[0]}</span>
                    <span className="text-[10px] text-gray-500 mt-1">{new Date(s.dob).getDate()} / {new Date(s.dob).getMonth()+1}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-6 rounded-3xl border shadow-sm flex flex-col items-center text-center bg-white dark:bg-gray-800 dark:border-gray-700">
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-gray-100 dark:border-gray-700 shadow-md mb-3 bg-blue-50 flex items-center justify-center">
              {data.settings?.classImage ? <img src={data.settings.classImage} className="w-full h-full object-cover" /> : <Users className="w-10 h-10 text-blue-400" />}
            </div>
            <h2 className="font-bold text-xl">{data.settings?.className}</h2>
            <p className="text-sm text-gray-500 mt-1">إجمالي المخدومين: {activeStudents.length} طفل</p>
          </div>

          <div className="p-5 rounded-3xl border shadow-sm bg-white dark:bg-gray-800 dark:border-gray-700">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-blue-500"/> الحضور (آخر 5 أسابيع)</h2>
            <div className="flex items-end justify-between h-40 gap-2 mt-6">
              {availableDates.slice(0, 5).reverse().map(date => {
                const present = Object.values(data.records[date] || {}).filter(r => r.present).length;
                const percent = Math.round((present / (activeStudents.length || 1)) * 100);
                return (
                  <div key={date} className="flex flex-col items-center flex-1 group">
                    <div className="text-[10px] text-gray-500 mb-1 font-bold">{present}</div>
                    <div className="w-full max-w-[40px] bg-blue-100 dark:bg-gray-700 rounded-t-lg relative flex items-end justify-center h-32">
                      <div className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg transition-all duration-1000" style={{ height: `${percent}%` }}></div>
                    </div>
                    <div className="text-[9px] mt-2 text-gray-400 truncate w-full text-center">{date.split('-').slice(1).join('/')}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 rounded-3xl border shadow-sm bg-white dark:bg-gray-800 dark:border-gray-700">
            <label className="text-sm font-bold text-gray-500 block mb-2">اختر تاريخ الخدمة لمراجعته:</label>
            <div className="relative">
              <Calendar className="w-5 h-5 absolute right-3 top-3.5 text-blue-500" />
              <select value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-full pl-4 pr-10 py-3 rounded-xl border outline-none font-bold appearance-none bg-transparent dark:border-gray-600">
                {availableDates.map(d => <option key={d} value={d} className="dark:bg-gray-800">{d}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-xl border border-green-100 dark:border-green-800 flex flex-col items-center">
                <span className="text-green-600 text-2xl font-black">{presentStudents.length}</span><span className="text-xs text-green-700 dark:text-green-400 font-bold mt-1">حاضرين</span>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-100 dark:border-red-800 flex flex-col items-center">
                <span className="text-red-600 text-2xl font-black">{absentStudents.length}</span><span className="text-xs text-red-700 dark:text-red-400 font-bold mt-1">غائبين</span>
              </div>
            </div>
          </div>
          <h3 className="font-bold text-lg mt-6 text-gray-500 border-b pb-2 dark:border-gray-700 flex justify-between">
            <span>الغياب يوم ({selectedDate})</span><span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">{absentStudents.length}</span>
          </h3>
          <div className="space-y-2">
            {absentStudents.map(s => (
               <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">{s.avatar ? <img src={s.avatar} className="w-full h-full object-cover"/> : <Users className="w-5 h-5 text-gray-400"/>}</div>
                    <div><span className="font-semibold text-sm block">{s.name}</span>{s.phone && <span className="text-xs text-gray-500 font-mono block mt-0.5">{s.phone}</span>}</div>
                  </div>
                  <button onClick={() => handleWhatsApp(s.phone, s.name)} disabled={!s.phone} className={`p-2.5 rounded-xl ${s.phone ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400 opacity-50'}`}><MessageCircle className="w-5 h-5" /></button>
               </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PrizesTab({ data, activeStudents }) {
  const studentPoints = useMemo(() => {
    const validDates = Object.keys(data.records || {}).filter(date => new Date(date) >= new Date(data.settings?.cycleStartDate || '2000-01-01'));
    return activeStudents.map(student => {
      let points = 0, presentCount = 0, commCount = 0;
      validDates.forEach(date => {
        const rec = data.records[date]?.[student.id];
        if (rec?.present) { points += 1; presentCount += 1; }
        if (rec?.communion) { points += 1; commCount += 1; }
        if (rec?.bonus) { points += 1; }
      });
      return { ...student, points, presentCount, commCount };
    }).sort((a, b) => b.points - a.points); 
  }, [activeStudents, data.records, data.settings?.cycleStartDate]);

  return (
    <div className="space-y-6 pb-10">
      <div className="p-5 rounded-3xl text-center shadow-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
        <Trophy className="w-12 h-12 mx-auto mb-2 text-yellow-300" />
        <h2 className="font-bold text-2xl mb-1">لوحة الشرف والجوائز</h2>
        <div className="flex justify-center gap-4 text-xs font-semibold bg-black/20 p-2 rounded-xl backdrop-blur-sm mt-4">
          <span className="flex items-center gap-1"><Trophy className="w-4 h-4 text-yellow-300"/> {data.settings?.bigPrizePoints} = كبرى</span>
          <span className="flex items-center gap-1"><Gift className="w-4 h-4 text-orange-300"/> {data.settings?.smallPrizePoints} = صغرى</span>
        </div>
      </div>
      <div className="space-y-3">
        {studentPoints.map((student, index) => {
          let PrizeIcon = null, prizeColor = '', prizeText = '';
          if (student.points >= (data.settings?.bigPrizePoints || 8)) { PrizeIcon = Trophy; prizeColor = 'text-yellow-500 bg-yellow-100'; prizeText = 'كبرى'; } 
          else if (student.points >= (data.settings?.smallPrizePoints || 4)) { PrizeIcon = Gift; prizeColor = 'text-orange-500 bg-orange-100'; prizeText = 'صغرى'; }

          return (
            <div key={student.id} className="flex items-center p-3 rounded-2xl border bg-white dark:bg-gray-800 shadow-sm">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ml-3 ${index < 3 ? 'bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900' : 'bg-gray-100 text-gray-500'}`}>{index + 1}</div>
              <div className="w-12 h-12 rounded-full overflow-hidden bg-blue-50 shrink-0 ml-3 border"><img src={student.avatar} className="w-full h-full object-cover" /></div>
              <div className="flex-1"><h3 className="font-bold text-sm leading-tight">{student.name}</h3><div className="text-[10px] text-gray-500 mt-1">{student.presentCount} حضور | {student.commCount} تناول</div></div>
              {PrizeIcon && <div className={`ml-[-10px] mr-2 p-2 rounded-xl flex flex-col items-center justify-center w-16 ${prizeColor}`}><PrizeIcon className="w-5 h-5 mb-1" /><span className="text-[8px] font-bold">{prizeText}</span></div>}
              <div className="flex flex-col items-center shrink-0 w-12"><div className="text-xl font-black text-indigo-600">{student.points}</div><span className="text-[9px] text-gray-400">نقطة</span></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StudentsTab({ data, updateData, showToast, servantName }) {
  const [view, setView] = useState('list'); 
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const calculateAge = (dob) => {
    if (!dob) return 'غير محدد';
    const age = new Date(Date.now() - new Date(dob).getTime());
    return `${Math.abs(age.getUTCFullYear() - 1970)} سنة`;
  };

  const handleSave = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const newStudent = {
      id: selectedStudent?.id || Date.now().toString(),
      name: fd.get('name'), phone: fd.get('phone') || '', dob: fd.get('dob') || '', notes: fd.get('notes') || '', active: true,
      visitationLog: selectedStudent?.visitationLog || [], avatar: selectedStudent?.avatar || ''
    };
    updateData(prev => {
      const list = [...(prev.students || [])];
      const idx = list.findIndex(s => s.id === newStudent.id);
      if (idx >= 0) list[idx] = newStudent; else list.push(newStudent);
      return { ...prev, students: list };
    });
    if (selectedStudent?.id) { setSelectedStudent(newStudent); setView('profile'); } else { setView('list'); }
    showToast('تم حفظ البيانات بنجاح');
  };

  const addVisit = () => {
    const note = prompt('تفاصيل الافتقاد (مكالمة، زيارة...):');
    if(note) {
      const log = [...(selectedStudent.visitationLog||[]), {date: TODAY, note, recordedBy: servantName}];
      setSelectedStudent(p => ({...p, visitationLog: log}));
      updateData(prev => {
        const list = [...prev.students];
        const i = list.findIndex(s => s.id === selectedStudent.id);
        if(i > -1) list[i].visitationLog = log;
        return {...prev, students: list};
      });
      showToast('تم إضافة سجل الافتقاد');
    }
  }

  if (view === 'edit') {
    return (
      <div className="space-y-4 pb-10">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{selectedStudent?.id ? 'تعديل بيانات' : 'إضافة طفل جديد'}</h2>
          <button type="button" onClick={() => setView(selectedStudent?.id ? 'profile' : 'list')} className="text-gray-500 font-bold">إلغاء</button>
        </div>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex justify-center mb-6">
            <label className="relative cursor-pointer">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 border-4 border-white shadow-md flex items-center justify-center dark:bg-gray-700">
                 {selectedStudent?.avatar ? <img src={selectedStudent.avatar} className="w-full h-full object-cover"/> : <Camera className="w-8 h-8 text-gray-400"/>}
              </div>
              <div className="absolute bottom-0 right-0 bg-blue-600 p-2 rounded-full text-white shadow-sm border-2 border-white"><Plus className="w-3 h-3"/></div>
              <input type="file" accept="image/*" className="hidden" onChange={e => compressImage(e.target.files[0], c => setSelectedStudent(p => ({...p, avatar: c})))} />
            </label>
          </div>
          <div><label className="text-xs font-bold text-gray-500 block">الاسم</label><input name="name" defaultValue={selectedStudent?.name} required className="w-full p-4 rounded-xl border dark:bg-gray-800 font-bold" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-bold text-gray-500 block">تليفون</label><input name="phone" defaultValue={selectedStudent?.phone} className="w-full p-4 rounded-xl border dark:bg-gray-800 font-mono" /></div>
            <div><label className="text-xs font-bold text-gray-500 block">تاريخ الميلاد</label><input name="dob" type="date" defaultValue={selectedStudent?.dob} className="w-full p-4 rounded-xl border dark:bg-gray-800 font-mono" /></div>
          </div>
          <div><label className="text-xs font-bold text-gray-500 block">ملاحظات</label><textarea name="notes" defaultValue={selectedStudent?.notes} className="w-full p-4 rounded-xl border dark:bg-gray-800" rows="2"/></div>
          <button type="submit" className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl mt-4 text-lg">حفظ بيانات الطفل</button>
        </form>
      </div>
    );
  }

  if (view === 'profile' && selectedStudent) {
    return (
      <div className="space-y-6 pb-10">
        <div className="flex items-center gap-4 mb-2">
          <button onClick={() => setView('list')} className="p-2 bg-gray-200 dark:bg-gray-700 rounded-full"><ChevronRight className="w-6 h-6" /></button>
          <div className="w-16 h-16 rounded-full overflow-hidden bg-blue-50 border shrink-0 flex items-center justify-center text-blue-300">
             {selectedStudent.avatar ? <img src={selectedStudent.avatar} className="w-full h-full object-cover"/> : <Users className="w-8 h-8"/>}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold">{selectedStudent.name}</h2>
            <div className="flex gap-2 text-xs text-gray-500 font-semibold mt-1"><span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {calculateAge(selectedStudent.dob)}</span></div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView('edit')} className="flex-1 py-3 bg-blue-100 text-blue-700 font-bold rounded-xl flex items-center justify-center gap-2"><Edit className="w-4 h-4"/> تعديل</button>
        </div>
        <div className="rounded-3xl border shadow-sm p-5 bg-white dark:bg-gray-800">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg flex items-center gap-2 text-purple-500"><MessageCircle className="w-5 h-5"/> سجل الافتقاد</h3>
            <button onClick={addVisit} className="bg-purple-100 text-purple-700 px-4 py-2 rounded-xl text-xs font-bold">+ إضافة</button>
          </div>
          <div className="space-y-3">
            {(selectedStudent.visitationLog || []).slice().reverse().map((v, i) => (
              <div key={i} className="p-3 rounded-2xl border-l-4 border-purple-500 bg-gray-50 dark:bg-gray-700">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-mono text-[10px] text-gray-500">{v.date}</span>
                  {v.recordedBy && <span className="text-[9px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{v.recordedBy}</span>}
                </div>
                <p className="text-sm font-semibold">{v.note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const filteredStudents = (data.students || []).filter(s => s.name.includes(searchTerm));
  return (
    <div className="space-y-4 pb-10">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute right-3 top-3.5 text-gray-400" />
          <input type="text" placeholder="بحث عن مخدوم..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-12 py-3 rounded-2xl border outline-none font-semibold bg-white dark:bg-gray-800" />
        </div>
        <button onClick={() => { setSelectedStudent(null); setView('edit'); }} className="bg-blue-600 text-white px-5 rounded-2xl font-bold shadow-md"><Plus className="w-6 h-6" /></button>
      </div>
      <div className="grid grid-cols-1 gap-3 mt-4">
        {filteredStudents.map(s => (
          <div key={s.id} onClick={() => { setSelectedStudent(s); setView('profile'); }} className="flex items-center justify-between p-3 border rounded-2xl cursor-pointer bg-white dark:bg-gray-800 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-blue-50 flex items-center justify-center text-blue-600 font-bold border">
                 {s.avatar ? <img src={s.avatar} className="w-full h-full object-cover"/> : s.name.split(' ')[0][0]}
              </div>
              <div>
                <h3 className="font-bold text-sm">{s.name}</h3>
                <span className="text-[10px] text-gray-500 flex items-center gap-1 mt-1"><Calendar className="w-3 h-3"/> {s.dob ? calculateAge(s.dob) : 'غير مسجل'}</span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsTab({ data, updateData, showToast, servantName }) {
  const updateSet = (updates) => updateData(p => ({...p, settings: {...p.settings, ...updates}}));
  
  return (
    <div className="space-y-6 pb-10">
      <button onClick={() => window.print()} className="w-full py-4 bg-gray-900 text-white dark:bg-white dark:text-gray-900 font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg text-lg">
        <Printer className="w-6 h-6"/> طباعة تقرير الخدمة (PDF)
      </button>

      <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border space-y-4">
        <h3 className="font-bold text-gray-500 text-sm mb-2">معلومات الفصل</h3>
        <input type="text" value={data.settings?.className} onChange={e=>updateSet({className: e.target.value})} className="w-full p-3 border rounded-xl dark:bg-gray-700 font-bold" />
        <label className="flex items-center gap-4 p-3 border rounded-xl cursor-pointer">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 border-2 flex items-center justify-center text-gray-400">
            {data.settings?.classImage ? <img src={data.settings.classImage} className="w-full h-full object-cover" /> : <Camera className="w-6 h-6" />}
          </div>
          <div className="flex-1"><h4 className="font-bold text-sm">صورة بروفايل الفصل</h4><p className="text-xs text-gray-500">اضغط لتغيير الصورة</p></div>
          <input type="file" accept="image/*" className="hidden" onChange={e => compressImage(e.target.files[0], c => {updateSet({classImage: c}); showToast('تم التحديث');})} />
        </label>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border space-y-4">
        <label className="flex items-center justify-between p-2"><span className="font-bold text-sm">الوضع الليلي</span><input type="checkbox" checked={data.settings?.darkMode} onChange={e=>updateSet({darkMode: e.target.checked})} className="w-5 h-5 rounded" /></label>
      </div>
      <div className="text-center text-xs text-gray-400 mt-8">مرحباً خادم الرب: {servantName}</div>
    </div>
  );
}