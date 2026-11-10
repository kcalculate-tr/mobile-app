// G26-S1 md.7 — oturum başına tek onay sheet'i: ertelenebilir teklif ikinci sheet olmaz.
import test from 'node:test';
import assert from 'node:assert/strict';
import { consentSheetShownThisSession, noteConsentSheet, resetConsentSheetSession } from '../sheetSession';

test('ilk onay sheet’i oturumu işaretler; sonrakiler değiştirmez', () => {
  resetConsentSheetSession();
  assert.equal(consentSheetShownThisSession(), false);
  noteConsentSheet('ai_photo');
  assert.equal(consentSheetShownThisSession(), true);
  noteConsentSheet('ai_coach');
  assert.equal(consentSheetShownThisSession(), true);
  resetConsentSheetSession();
  assert.equal(consentSheetShownThisSession(), false);
});
