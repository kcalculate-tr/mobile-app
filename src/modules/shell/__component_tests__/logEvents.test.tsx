// G13-S1 m.4 — logFlight olayları tek kaynakta: diğer modüller yalnız yeniden
// dışa verir (aynı fonksiyon/sabit kimliği), yayın/dinleme aynı kanalda.
import * as shell from '../logEvents';
import * as gun from '../../gun/logFlight';
import * as kesfet from '../../kesfet/events';
import * as scan from '../../ai/scan/logFlight';

test('olay adları ve yardımcılar tek kaynaktan (kimlik eşit)', () => {
  for (const m of [gun, kesfet, scan]) {
    expect(m.LOG_FLIGHT_EVENT).toBe('kcal:logFlight');
    expect(m.LOG_UNDO_EVENT).toBe('kcal:logUndo');
    expect(m.emitLogFlight).toBe(shell.emitLogFlight);
    expect(m.emitLogUndo).toBe(shell.emitLogUndo);
  }
  expect(gun.onLogFlight).toBe(shell.onLogFlight);
  expect(gun.onLogUndo).toBe(shell.onLogUndo);
});

test('Keşfet/Tara yayını Ana sayfa dinleyicisine ulaşır; Geri al { id } yükü', () => {
  const flights: unknown[] = [];
  const undos: unknown[] = [];
  const a = shell.onLogFlight((p) => flights.push(p));
  const b = shell.onLogUndo((p) => undos.push(p));
  kesfet.emitLogFlight({ x: 1, y: 2, w: 3, h: 4, imageUri: null, mealLabel: 'Öğle' });
  scan.emitLogFlight({ x: 0, y: 0, w: 0, h: 0, mealLabel: 'Akşam' });
  scan.emitLogUndo({ id: 'c9' });
  a.remove();
  b.remove();
  expect(flights).toHaveLength(2);
  expect(undos).toEqual([{ id: 'c9' }]);
});
