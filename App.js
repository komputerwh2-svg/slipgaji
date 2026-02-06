import React, { useState, useEffect, createContext, useContext } from 'react';
import { 
  Text, View, StyleSheet, TextInput, ScrollView, 
  TouchableOpacity, FlatList, Alert, Modal, Switch, Clipboard 
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons'; 

// --- CONTEXT ---
const GajiContext = createContext();
const ThemeContext = createContext();

// --- KONSTANTA ---
const DAFTAR_BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const TAHUN_SAAT_INI = new Date().getFullYear();
const DAFTAR_TAHUN = Array.from({length: 11}, (_, i) => (TAHUN_SAAT_INI - 5 + i).toString());

const RIWAYAT_CODING = [
  { ver: "v2.0.1", desc: "Restoration: Mengembalikan Selisih Audit & Riwayat Coding yang sempat hilang di v2.0.0." },
  { ver: "v2.0.0", desc: "Backup Feature: Ekspor & Impor data via Clipboard." },
  { ver: "v1.9.9", desc: "Solid Sync: Input Pengaturan (KSP, BPJS, dll) lengkap." },
  { ver: "v1.9.8", desc: "Safety Patch: Fix error 'Cannot convert undefined or null'." },
  { ver: "v1.0-1.9.7", desc: "Base features: Edit mode, auto-calc, & theme support." }
];

// --- UTILS ---
const formatRibuan = (angka) => {
  if (!angka && angka !== 0) return '0';
  const bersih = Math.round(Math.abs(angka)).toString().replace(/\D/g, '');
  const hasil = bersih.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return angka < 0 ? `-${hasil}` : hasil;
};

const unformatRibuan = (teks) => {
  if (!teks) return 0;
  const num = Number(teks.replace(/\./g, ''));
  return isNaN(num) ? 0 : num;
};

// --- KOMPONEN INPUT ---
const InputGaji = ({ label, value, onChange, theme, editable = true, sublabel = "" }) => (
  <View style={styles.inputGroup}>
    <View style={{flexDirection:'row', justifyContent:'space-between'}}>
      <Text style={[styles.miniLabel, { color: theme.textSecondary }]}>{label}</Text>
      {sublabel ? <Text style={{fontSize: 9, color: theme.primary, fontWeight:'bold'}}>{sublabel}</Text> : null}
    </View>
    <TextInput 
      style={[styles.input, { color: editable ? theme.text : '#7f8c8d', borderColor: theme.border, backgroundColor: editable ? 'transparent' : (theme.isDarkMode ? '#222' : '#f0f0f0') }]} 
      placeholder="0" 
      placeholderTextColor="#999"
      keyboardType="numeric" 
      value={formatRibuan(value || 0)}
      onChangeText={(val) => editable && onChange(unformatRibuan(val))}
      editable={editable}
    />
  </View>
);

// --- TAB 1: INPUT SLIP ---
function SlipGajiScreen({ navigation, route }) {
  const { theme } = useContext(ThemeContext);
  const { simpanDataGaji, setelanGaji, updateDataGaji } = useContext(GajiContext);
  
  const [editId, setEditId] = useState(null);
  const [bulan, setBulan] = useState(DAFTAR_BULAN[new Date().getMonth()]);
  const [tahun, setTahun] = useState(TAHUN_SAAT_INI.toString());
  const [modalPeriode, setModalPeriode] = useState(false);

  const [pemasukan, setPemasukan] = useState({ pokok: 0, transport: 0, makan: 0, premi: 0, koreksi_plus: 0 });
  const [potongan, setPotongan] = useState({ cicilan_hutang: 0, ksp: 0, jamsostek: 0, bpjs: 0, koreksi_minus: 0 });
  const [absensi, setAbsensi] = useState({ sakit: 0, izin: 0, alpha: 0, cuti: 0, terlambat: 0, overtime: 0, extra: 0, imt: 0 });

  const resetFormKeDefault = () => {
    setEditId(null);
    setPemasukan({ pokok: (setelanGaji?.harian || 0) * 50, transport: 0, makan: 0, premi: setelanGaji?.premi || 0, koreksi_plus: 0 });
    setPotongan({ cicilan_hutang: 0, ksp: setelanGaji?.ksp || 0, jamsostek: setelanGaji?.jamsostek || 0, bpjs: setelanGaji?.bpjs || 0, koreksi_minus: 0 });
    setAbsensi({ sakit: 0, izin: 0, alpha: 0, cuti: 0, terlambat: 0, overtime: 0, extra: 0, imt: 0 });
  };

  useEffect(() => {
    if (route.params?.editData) {
      const d = route.params.editData;
      setEditId(d.id);
      const [b, t] = d.periode.split(' ');
      setBulan(b); setTahun(t);
      setPemasukan(d.detailMasuk || {}); setPotongan(d.detailPotong || {}); setAbsensi(d.detailAbsensi || {});
    } else {
      resetFormKeDefault();
    }
  }, [route.params, setelanGaji]);

  useEffect(() => {
    const harian = setelanGaji?.harian || 0;
    const p = setelanGaji?.persen || {};
    const totalPotonganAbsen = (absensi.sakit * harian * (p.sakit || 0)) + (absensi.izin * harian * (p.izin || 0)) + (absensi.alpha * harian * (p.alpha || 0)) + (absensi.terlambat * (p.terlambat || 0));
    const totalTambahanAbsen = (absensi.overtime * (harian / 7) * (p.overtime || 0)) + (absensi.extra * harian * (p.extra || 0)) + (absensi.imt * (p.imt || 0));
    setPotongan(prev => ({ ...prev, koreksi_minus: totalPotonganAbsen }));
    setPemasukan(prev => ({ ...prev, koreksi_plus: totalTambahanAbsen }));
  }, [absensi, setelanGaji]);

  const handleSimpan = async () => {
    const totalMasuk = Object.values(pemasukan).reduce((a, b) => a + b, 0);
    const totalPotong = Object.values(potongan).reduce((a, b) => a + b, 0);
    const dataUpdate = { id: editId || Date.now().toString(), periode: `${bulan} ${tahun}`, total: totalMasuk - totalPotong, detailMasuk: pemasukan, detailPotong: potongan, detailAbsensi: absensi };
    if (editId) { await updateDataGaji(dataUpdate); Alert.alert("Update", "Data diperbarui!"); }
    else { await simpanDataGaji(dataUpdate); Alert.alert("Sukses", "Data tersimpan!"); }
    resetFormKeDefault();
    navigation.navigate('Rangkuman');
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.header, { color: theme.text }]}>{editId ? 'Edit Slip Gaji' : 'Input Slip Gaji'}</Text>
      
      <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>1. Periode</Text>
        <TouchableOpacity style={styles.pickerTrigger} onPress={() => setModalPeriode(true)}>
          <Text style={{fontSize: 16, fontWeight: 'bold', color: theme.primary}}>{bulan} {tahun}</Text>
          <Ionicons name="calendar-outline" size={20} color={theme.primary} />
        </TouchableOpacity>
      </View>

      <View style={[styles.section, { backgroundColor: theme.card, borderColor: '#27ae60' }]}>
        <Text style={[styles.sectionTitle, { color: '#27ae60' }]}>2. Pemasukan</Text>
        <InputGaji label="GAJI POKOK" value={pemasukan.pokok} theme={theme} editable={false} />
        <InputGaji label="TRANSPORT" value={pemasukan.transport} onChange={(v) => setPemasukan({...pemasukan, transport: v})} theme={theme} />
        <InputGaji label="MAKAN" value={pemasukan.makan} onChange={(v) => setPemasukan({...pemasukan, makan: v})} theme={theme} />
        <InputGaji label="PREMI" value={pemasukan.premi} onChange={(v) => setPemasukan({...pemasukan, premi: v})} theme={theme} />
        <InputGaji label="KOREKSI (+)" value={pemasukan.koreksi_plus} sublabel="OT/Extra Auto" onChange={(v) => setPemasukan({...pemasukan, koreksi_plus: v})} theme={theme} />
      </View>

      <View style={[styles.section, { backgroundColor: theme.card, borderColor: '#e74c3c' }]}>
        <Text style={[styles.sectionTitle, { color: '#e74c3c' }]}>3. Potongan</Text>
        <InputGaji label="CICILAN HUTANG" value={potongan.cicilan_hutang} onChange={(v) => setPotongan({...potongan, cicilan_hutang: v})} theme={theme} />
        <InputGaji label="KSP" value={potongan.ksp} onChange={(v) => setPotongan({...potongan, ksp: v})} theme={theme} />
        <InputGaji label="JAMSOSTEK" value={potongan.jamsostek} onChange={(v) => setPotongan({...potongan, jamsostek: v})} theme={theme} />
        <InputGaji label="BPJS" value={potongan.bpjs} onChange={(v) => setPotongan({...potongan, bpjs: v})} theme={theme} />
        <InputGaji label="KOREKSI (-)" value={potongan.koreksi_minus} sublabel="Absen Auto" onChange={(v) => setPotongan({...potongan, koreksi_minus: v})} theme={theme} />
      </View>

      <View style={[styles.section, { backgroundColor: theme.card, borderColor: '#f39c12' }]}>
        <Text style={[styles.sectionTitle, { color: '#f39c12' }]}>4. Absensi (Hari)</Text>
        <View style={styles.rowGrid}>
          {Object.keys(absensi || {}).map(key => (
            <View key={key} style={{width: '48%'}}><InputGaji label={key.toUpperCase()} value={absensi[key]} onChange={(v) => setAbsensi({...absensi, [key]: v})} theme={theme} /></View>
          ))}
        </View>
      </View>

      <TouchableOpacity style={[styles.btnSimpan, { backgroundColor: theme.primary }]} onPress={handleSimpan}><Text style={styles.btnText}>{editId ? 'UPDATE DATA' : 'SIMPAN DATA'}</Text></TouchableOpacity>
      
      <Modal visible={modalPeriode} transparent animationType="fade">
        <View style={styles.modalOverlay}><View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Pilih Periode</Text>
            <View style={styles.row}>
              <ScrollView style={{height: 250}}>{DAFTAR_BULAN.map(b => (
                <TouchableOpacity key={b} onPress={() => setBulan(b)} style={[styles.itemPilih, bulan === b && {backgroundColor: theme.primary}]}><Text style={bulan === b ? {color:'#fff'} : {color: theme.text}}>{b}</Text></TouchableOpacity>
              ))}</ScrollView>
              <ScrollView style={{height: 250}}>{DAFTAR_TAHUN.map(t => (
                <TouchableOpacity key={t} onPress={() => setTahun(t)} style={[styles.itemPilih, tahun === t && {backgroundColor: theme.primary}]}><Text style={tahun === t ? {color:'#fff'} : {color: theme.text}}>{t}</Text></TouchableOpacity>
              ))}</ScrollView>
            </View>
            <TouchableOpacity style={[styles.btnTutup, {backgroundColor: '#27ae60', marginTop: 20}]} onPress={() => setModalPeriode(false)}><Text style={{color:'#fff', fontWeight:'bold'}}>SELESAI</Text></TouchableOpacity>
        </View></View>
      </Modal>
      <View style={{height: 100}} />
    </ScrollView>
  );
}

// --- TAB 2: RANGKUMAN ---
function RangkumanScreen({ navigation }) {
  const { theme } = useContext(ThemeContext);
  const { listGaji } = useContext(GajiContext);
  const [selected, setSelected] = useState(null);
  const [prevData, setPrevData] = useState(null);

  const handleOpenDetail = (item, index) => { setSelected(item); setPrevData(listGaji[index + 1] || null); };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList 
        data={listGaji} 
        keyExtractor={i => i.id} 
        renderItem={({item, index}) => {
          const dataLama = listGaji[index + 1];
          const selisih = dataLama ? item.total - dataLama.total : 0;
          return (
            <TouchableOpacity style={[styles.cardRangkuman, { backgroundColor: theme.card }]} onPress={() => handleOpenDetail(item, index)}>
              <View><Text style={styles.txtPeriode}>{item.periode}</Text><Text style={[styles.txtTotal, {color: theme.text}]}>Rp {formatRibuan(item.total)}</Text></View>
              {dataLama && (
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                  <Ionicons name={selisih >= 0 ? "trending-up" : "trending-down"} size={16} color={selisih >= 0 ? '#27ae60' : '#e74c3c'} />
                  <Text style={{color: selisih >= 0 ? '#27ae60' : '#e74c3c', fontWeight: 'bold', marginLeft: 4, fontSize: 12}}>{formatRibuan(Math.abs(selisih))}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }} 
      />
      <Modal visible={!!selected} transparent animationType="slide">
         <View style={styles.modalOverlay}><View style={[styles.modalContent, {backgroundColor: theme.card, maxHeight: '90%'}]}>
          <View style={styles.rowBetween}>
            <Text style={[styles.modalTitle, {color: theme.text}]}>Detail {selected?.periode}</Text>
            <TouchableOpacity onPress={() => { const d = selected; setSelected(null); navigation.navigate('Input', { editData: d }); }} style={{padding: 5}}><Ionicons name="create-outline" size={24} color={theme.primary} /></TouchableOpacity>
          </View>
          <ScrollView>
              <Text style={styles.detailHeader}>PEMASUKAN</Text>
              {selected && Object.keys(selected.detailMasuk || {}).map(k => {
                const diff = prevData ? selected.detailMasuk[k] - prevData.detailMasuk[k] : 0;
                return (
                  <View key={k} style={styles.detailRow}>
                    <Text style={styles.capitalize}>{k.replace('_',' ')}</Text>
                    <View style={{alignItems:'flex-end'}}>
                      <Text style={{color: theme.text}}>Rp {formatRibuan(selected.detailMasuk[k])}</Text>
                      {prevData && diff !== 0 && <Text style={{fontSize:9, color: diff > 0 ? '#27ae60' : '#e74c3c'}}>{diff > 0 ? '+' : ''}{formatRibuan(diff)}</Text>}
                    </View>
                  </View>
                )
              })}
              <Text style={[styles.detailHeader, {color:'#e74c3c', marginTop:10}]}>POTONGAN</Text>
              {selected && Object.keys(selected.detailPotong || {}).map(k => {
                const diff = prevData ? selected.detailPotong[k] - prevData.detailPotong[k] : 0;
                return (
                  <View key={k} style={styles.detailRow}>
                    <Text style={styles.capitalize}>{k.replace('_',' ')}</Text>
                    <View style={{alignItems:'flex-end'}}>
                      <Text style={{color: theme.text}}>Rp {formatRibuan(selected.detailPotong[k])}</Text>
                      {prevData && diff !== 0 && <Text style={{fontSize:9, color: diff > 0 ? '#e74c3c' : '#27ae60'}}>{diff > 0 ? '+' : ''}{formatRibuan(diff)}</Text>}
                    </View>
                  </View>
                )
              })}
          </ScrollView>
          <TouchableOpacity style={[styles.btnTutup, {backgroundColor: theme.primary, marginTop: 15}]} onPress={() => setSelected(null)}><Text style={{color:'#fff'}}>TUTUP</Text></TouchableOpacity>
        </View></View>
      </Modal>
    </View>
  );
}

// --- TAB 3: PENGATURAN ---
function PengaturanScreen() {
  const { theme, isDarkMode, setIsDarkMode } = useContext(ThemeContext);
  const { hapusSemua, setelanGaji, updateSetelanGaji, listGaji, restoreData } = useContext(GajiContext);
  const [importText, setImportText] = useState("");

  const handleExport = () => {
    const dataString = JSON.stringify({ listGaji, setelanGaji });
    Clipboard.setString(dataString);
    Alert.alert("Sukses", "Data disalin ke Clipboard! Tempelkan ke WA/Catatan untuk backup.");
  };

  const handleImport = () => {
    if (!importText) return Alert.alert("Error", "Tempel kode backup dulu.");
    Alert.alert("Konfirmasi", "Data sekarang akan ditimpa. Lanjutkan?", [
      { text: "Batal" },
      { text: "Impor", onPress: () => {
        try {
          const p = JSON.parse(importText);
          if (p.listGaji && p.setelanGaji) { restoreData(p.listGaji, p.setelanGaji); setImportText(""); Alert.alert("Sukses", "Data dipulihkan!"); }
          else throw new Error();
        } catch(e) { Alert.alert("Gagal", "Format kode salah."); }
      }}
    ]);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.header, { color: theme.text }]}>Pengaturan</Text>

      <View style={[styles.section, { backgroundColor: theme.card, borderColor: '#27ae60' }]}>
        <Text style={[styles.sectionTitle, { color: '#27ae60' }]}>💾 Cadangkan & Pulihkan</Text>
        <TouchableOpacity style={[styles.btnBackup, {backgroundColor: '#27ae60'}]} onPress={handleExport}>
          <Ionicons name="copy-outline" size={18} color="#fff" />
          <Text style={{color:'#fff', fontWeight:'bold', marginLeft: 8}}>EKSPOR DATA</Text>
        </TouchableOpacity>
        <TextInput 
          style={[styles.inputImport, {color: theme.text, borderColor: theme.border, marginTop: 15}]} 
          placeholder="Tempel kode di sini..." placeholderTextColor="#999" multiline value={importText} onChangeText={setImportText}
        />
        <TouchableOpacity style={[styles.btnBackup, {backgroundColor: theme.primary, marginTop: 10}]} onPress={handleImport}>
          <Ionicons name="download-outline" size={18} color="#fff" />
          <Text style={{color:'#fff', fontWeight:'bold', marginLeft: 8}}>IMPOR DATA</Text>
        </TouchableOpacity>
      </View>
      
      <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.primary }]}>
        <Text style={[styles.sectionTitle, { color: theme.primary }]}>⚙️ Setelan Gaji Tetap</Text>
        <InputGaji label="HARIAN" value={setelanGaji?.harian} onChange={(v) => updateSetelanGaji('harian', v)} theme={theme} />
        <InputGaji label="PREMI" value={setelanGaji?.premi} onChange={(v) => updateSetelanGaji('premi', v)} theme={theme} />
        <InputGaji label="IURAN KSP" value={setelanGaji?.ksp} onChange={(v) => updateSetelanGaji('ksp', v)} theme={theme} />
        <InputGaji label="IURAN JAMSOSTEK" value={setelanGaji?.jamsostek} onChange={(v) => updateSetelanGaji('jamsostek', v)} theme={theme} />
        <InputGaji label="IURAN BPJS" value={setelanGaji?.bpjs} onChange={(v) => updateSetelanGaji('bpjs', v)} theme={theme} />
      </View>

      <View style={[styles.section, { backgroundColor: theme.card, borderColor: '#9b59b6' }]}>
        <Text style={[styles.sectionTitle, { color: '#9b59b6' }]}>📊 Multiplier Absensi</Text>
        <View style={styles.rowGrid}>
          {['sakit','izin','alpha','cuti','terlambat','overtime','extra','imt'].map(key => (
            <View key={key} style={{width: '48%'}}><TextInput style={[styles.input, { color: theme.text, borderColor: theme.border, marginBottom: 10 }]} keyboardType="numeric" value={String(setelanGaji?.persen?.[key] || 0)} onChangeText={(v) => updateSetelanGaji('persen', {...setelanGaji.persen, [key]: parseFloat(v) || 0})} /><Text style={{fontSize: 9, color: 'gray', textAlign:'center', marginBottom: 5}}>{key.toUpperCase()}</Text></View>
          ))}
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border, height: 150 }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>🚀 Riwayat Coding</Text>
        <ScrollView nestedScrollEnabled={true}>{RIWAYAT_CODING.map((item, index) => (
          <View key={index} style={styles.historyItem}><View style={[styles.versionBadge, {backgroundColor: theme.primary}]}><Text style={styles.versionText}>{item.ver}</Text></View><Text style={[styles.descText, {color: theme.textSecondary}]}>{item.desc}</Text></View>
        ))}</ScrollView>
      </View>

      <View style={[styles.rowBetween, {padding: 10}]}><Text style={{color: theme.text}}>Mode Gelap</Text><Switch value={isDarkMode} onValueChange={setIsDarkMode} /></View>
      <TouchableOpacity style={[styles.btnSimpan, {backgroundColor:'#e74c3c', marginBottom: 50}]} onPress={hapusSemua}><Text style={styles.btnText}>HAPUS SEMUA DATA</Text></TouchableOpacity>
    </ScrollView>
  );
}

// --- APP CORE ---
const Tab = createBottomTabNavigator();
export default function App() {
  const [listGaji, setListGaji] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [setelanGaji, setSetelanGaji] = useState({ harian: 0, premi: 0, ksp: 0, jamsostek: 0, bpjs: 0, persen: { sakit: 1, izin: 1, alpha: 2, cuti: 0, terlambat: 500, overtime: 1.5, extra: 1, imt: 1 } });
  const theme = { background: isDarkMode ? '#121212' : '#f4f7f6', card: isDarkMode ? '#1e1e1e' : '#fff', text: isDarkMode ? '#fff' : '#2c3e50', textSecondary: isDarkMode ? '#aaa' : '#7f8c8d', border: isDarkMode ? '#333' : '#ddd', primary: '#3498db', isDarkMode };
  
  useEffect(() => { (async () => {
    const savedGaji = await AsyncStorage.getItem('@gaji_master_db_v4');
    const savedSetelan = await AsyncStorage.getItem('@setelan_gaji_v1');
    if (savedGaji) setListGaji(JSON.parse(savedGaji));
    if (savedSetelan) setSetelanGaji(JSON.parse(savedSetelan));
  })() }, []);

  const restoreData = async (newList, newSetelan) => {
    setListGaji(newList); setSetelanGaji(newSetelan);
    await AsyncStorage.setItem('@gaji_master_db_v4', JSON.stringify(newList));
    await AsyncStorage.setItem('@setelan_gaji_v1', JSON.stringify(newSetelan));
  };
  const updateDataGaji = async (updated) => { const newList = listGaji.map(i => i.id === updated.id ? updated : i); setListGaji(newList); await AsyncStorage.setItem('@gaji_master_db_v4', JSON.stringify(newList)); };
  const simpanDataGaji = async (data) => { const newList = [data, ...listGaji]; setListGaji(newList); await AsyncStorage.setItem('@gaji_master_db_v4', JSON.stringify(newList)); };
  const updateSetelanGaji = async (key, val) => { const newSetelan = { ...setelanGaji, [key]: val }; setSetelanGaji(newSetelan); await AsyncStorage.setItem('@setelan_gaji_v1', JSON.stringify(newSetelan)); };
  const hapusSemua = () => { Alert.alert("Hapus", "Hapus semua data?", [{text:"Batal"}, {text:"Ya", onPress: async () => { setListGaji([]); await AsyncStorage.removeItem('@gaji_master_db_v4'); }}]); };

  return (
    <ThemeContext.Provider value={{ theme, isDarkMode, setIsDarkMode }}>
      <GajiContext.Provider value={{ listGaji, simpanDataGaji, updateDataGaji, setelanGaji, updateSetelanGaji, hapusSemua, restoreData }}>
        <NavigationContainer>
          <Tab.Navigator screenOptions={({ route }) => ({ headerStyle:{backgroundColor: theme.card}, headerTintColor: theme.text, tabBarStyle: {backgroundColor: theme.card}, tabBarActiveTintColor: theme.primary, tabBarIcon: ({ focused, color, size }) => { let iconName = route.name === 'Input' ? 'add-circle' : route.name === 'Rangkuman' ? 'stats-chart' : 'settings'; return <Ionicons name={focused ? iconName : iconName + '-outline'} size={size} color={color} />; } })}>
            <Tab.Screen name="Input" component={SlipGajiScreen} />
            <Tab.Screen name="Rangkuman" component={RangkumanScreen} />
            <Tab.Screen name="Pengaturan" component={PengaturanScreen} />
          </Tab.Navigator>
        </NavigationContainer>
      </GajiContext.Provider>
    </ThemeContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15 },
  header: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  section: { padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1 },
  sectionTitle: { fontSize: 13, fontWeight: 'bold', marginBottom: 10 },
  inputGroup: { marginBottom: 10 },
  miniLabel: { fontSize: 10, fontWeight: 'bold', marginBottom: 2 },
  input: { borderBottomWidth: 1, paddingVertical: 5, fontSize: 16, borderRadius: 5, paddingHorizontal: 5 },
  btnSimpan: { padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  pickerTrigger: { flexDirection: 'row', justifyContent: 'space-between', alignItems:'center', padding: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  modalContent: { borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-around' },
  btnTutup: { padding: 12, borderRadius: 10, alignItems: 'center' },
  cardRangkuman: { padding: 15, borderRadius: 12, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  txtPeriode: { fontSize: 12, color: 'gray' },
  txtTotal: { fontSize: 16, fontWeight: 'bold' },
  detailHeader: { fontSize: 14, fontWeight: 'bold', color: '#27ae60', borderBottomWidth: 1, borderColor: '#eee', paddingBottom: 5, marginBottom: 8 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  capitalize: { textTransform: 'uppercase', fontSize: 12, color: 'gray' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  btnBackup: { flexDirection: 'row', padding: 12, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  inputImport: { borderWidth: 1, borderRadius: 10, padding: 10, height: 80, fontSize: 12, textAlignVertical: 'top' },
  historyItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 5 },
  versionBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 8 },
  versionText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  descText: { fontSize: 11, flex: 1 },
  itemPilih: { padding: 10, borderRadius: 8, marginVertical: 2 }
});
