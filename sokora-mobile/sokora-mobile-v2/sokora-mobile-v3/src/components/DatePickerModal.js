/**
 * DatePickerModal — Calendrier SOKORA
 * Calendrier visuel sans package externe, compatible Expo Go
 */
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const MONTHS_FR = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
];
const DAYS_FR = ['Lu','Ma','Me','Je','Ve','Sa','Di'];

function parseDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(date) {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplay(str) {
  if (!str) return '';
  const d = parseDate(str);
  if (!d) return str;
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year, month) {
  // 0=lundi, 6=dimanche
  let d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

export default function DatePickerModal({
  value,
  onChange,
  placeholder = 'Sélectionner une date',
  label,
  minDate,
  maxDate,
  style,
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const initDate = value ? parseDate(value) : today;
  const [visible, setVisible]   = useState(false);
  const [year,    setYear]      = useState(initDate.getFullYear());
  const [month,   setMonth]     = useState(initDate.getMonth());
  const [selected, setSelected] = useState(value || '');

  const minD = minDate ? parseDate(minDate) : today;
  const maxD = maxDate ? parseDate(maxDate) : null;

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const selectDay = (day) => {
    const date = new Date(year, month, day);
    const str  = formatDate(date);
    setSelected(str);
    onChange(str);
    setTimeout(() => setVisible(false), 150);
  };

  const isDisabled = (day) => {
    const date = new Date(year, month, day);
    date.setHours(0, 0, 0, 0);
    if (minD && date < minD) return true;
    if (maxD && date > maxD) return true;
    return false;
  };

  const isSelected = (day) => {
    if (!selected) return false;
    const sel = parseDate(selected);
    return sel && sel.getFullYear() === year && sel.getMonth() === month && sel.getDate() === day;
  };

  const isToday = (day) => {
    return today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
  };

  const daysInMonth  = getDaysInMonth(year, month);
  const firstDayIdx  = getFirstDayOfWeek(year, month);
  const totalCells   = firstDayIdx + daysInMonth;
  const rows         = Math.ceil(totalCells / 7);

  const open = () => {
    if (selected) {
      const d = parseDate(selected);
      if (d) { setYear(d.getFullYear()); setMonth(d.getMonth()); }
    }
    setVisible(true);
  };

  return (
    <>
      {/* ── Trigger ── */}
      <TouchableOpacity style={[s.trigger, style]} onPress={open} activeOpacity={0.8}>
        <Ionicons name="calendar-outline" size={18} color="#FF6B35" />
        <Text style={[s.triggerTxt, !value && s.placeholder]}>
          {value ? formatDisplay(value) : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color="#8892A4" />
      </TouchableOpacity>

      {/* ── Modal ── */}
      <Modal visible={visible} animationType="slide" transparent onRequestClose={() => setVisible(false)}>
        <View style={s.overlay}>
          <View style={s.sheet}>

            {/* Header */}
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>{label || 'Choisir une date'}</Text>
              <TouchableOpacity onPress={() => setVisible(false)} style={s.closeBtn}>
                <Ionicons name="close" size={22} color="#8892A4" />
              </TouchableOpacity>
            </View>

            {/* Date sélectionnée */}
            {selected && (
              <View style={s.selectedBanner}>
                <Ionicons name="checkmark-circle" size={16} color="#FF6B35" />
                <Text style={s.selectedTxt}>{formatDisplay(selected)}</Text>
              </View>
            )}

            {/* Nav mois */}
            <View style={s.navRow}>
              <TouchableOpacity style={s.navBtn} onPress={prevMonth}>
                <Ionicons name="chevron-back" size={20} color="#1A1A2E" />
              </TouchableOpacity>
              <Text style={s.navTitle}>{MONTHS_FR[month]} {year}</Text>
              <TouchableOpacity style={s.navBtn} onPress={nextMonth}>
                <Ionicons name="chevron-forward" size={20} color="#1A1A2E" />
              </TouchableOpacity>
            </View>

            {/* Jours semaine */}
            <View style={s.weekRow}>
              {DAYS_FR.map(d => (
                <Text key={d} style={s.weekDay}>{d}</Text>
              ))}
            </View>

            {/* Grille calendrier */}
            <View style={s.grid}>
              {Array.from({ length: rows * 7 }).map((_, idx) => {
                const dayNum = idx - firstDayIdx + 1;
                const valid  = dayNum >= 1 && dayNum <= daysInMonth;
                const dis    = valid && isDisabled(dayNum);
                const sel    = valid && isSelected(dayNum);
                const tod    = valid && isToday(dayNum);

                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      s.cell,
                      sel && s.cellSelected,
                      tod && !sel && s.cellToday,
                      dis && s.cellDisabled,
                      !valid && s.cellEmpty,
                    ]}
                    onPress={() => valid && !dis && selectDay(dayNum)}
                    disabled={!valid || dis}
                    activeOpacity={0.7}
                  >
                    {valid && (
                      <Text style={[
                        s.cellTxt,
                        sel && s.cellTxtSelected,
                        tod && !sel && s.cellTxtToday,
                        dis && s.cellTxtDisabled,
                      ]}>
                        {dayNum}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Raccourcis */}
            <View style={s.shortcuts}>
              {[
                { label: "Aujourd'hui", date: formatDate(today) },
                { label: 'Demain', date: formatDate(new Date(today.getTime() + 86400000)) },
                { label: 'Dans 3j', date: formatDate(new Date(today.getTime() + 3 * 86400000)) },
                { label: 'Dans 7j', date: formatDate(new Date(today.getTime() + 7 * 86400000)) },
              ].map(sc => (
                <TouchableOpacity
                  key={sc.label}
                  style={[s.shortcut, selected === sc.date && s.shortcutActive]}
                  onPress={() => { setSelected(sc.date); onChange(sc.date); setVisible(false); }}
                >
                  <Text style={[s.shortcutTxt, selected === sc.date && s.shortcutTxtActive]}>
                    {sc.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

          </View>
        </View>
      </Modal>
    </>
  );
}

const CELL = 42;

const s = StyleSheet.create({
  trigger: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F4F6F9', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13,
    borderWidth: 1.5, borderColor: '#DDE4F0',
  },
  triggerTxt:  { flex: 1, fontSize: 14, color: '#1A1A2E', fontWeight: '500' },
  placeholder: { color: '#8892A4', fontWeight: '400' },

  overlay: { flex: 1, backgroundColor: 'rgba(15,30,53,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingBottom: 32,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: -5 },
    elevation: 20,
  },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#F0F2F8',
  },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: '#1A1A2E' },
  closeBtn:   { padding: 4 },

  selectedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 12,
    backgroundColor: '#FFF4EF', borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: '#FFD4C0',
  },
  selectedTxt: { fontSize: 13, fontWeight: '700', color: '#FF6B35' },

  navRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16 },
  navBtn:   { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F4F6F9', alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 16, fontWeight: '800', color: '#1A1A2E' },

  weekRow: { flexDirection: 'row', paddingHorizontal: 12, marginBottom: 6 },
  weekDay: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#8892A4', textTransform: 'uppercase', letterSpacing: 0.5 },

  grid:     { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12 },
  cell:     { width: `${100/7}%`, height: CELL, alignItems: 'center', justifyContent: 'center' },
  cellSelected: { backgroundColor: '#FF6B35', borderRadius: CELL/2 },
  cellToday:    { backgroundColor: '#FFF4EF', borderRadius: CELL/2 },
  cellDisabled: { opacity: 0.25 },
  cellEmpty:    {},
  cellTxt:          { fontSize: 14, fontWeight: '600', color: '#1A1A2E' },
  cellTxtSelected:  { color: '#fff', fontWeight: '800' },
  cellTxtToday:     { color: '#FF6B35', fontWeight: '800' },
  cellTxtDisabled:  { color: '#8892A4' },

  shortcuts: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 12, flexWrap: 'wrap' },
  shortcut: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#F4F6F9', borderWidth: 1.5, borderColor: '#DDE4F0',
  },
  shortcutActive:    { backgroundColor: '#FF6B35', borderColor: '#FF6B35' },
  shortcutTxt:       { fontSize: 12, fontWeight: '700', color: '#8892A4' },
  shortcutTxtActive: { color: '#fff' },
});
