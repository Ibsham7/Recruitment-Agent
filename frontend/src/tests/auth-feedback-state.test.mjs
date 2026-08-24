import test from 'node:test';
import assert from 'node:assert/strict';

// Helper function simulating the ErrorContainer rendering logic
function getAlertStyles({ theme, error, success }) {
  if (!error && !success) return null;

  const isSuccess = !error && Boolean(success);
  const message = error || success;
  const color = isSuccess ? theme.numPos : theme.numNeg;
  const iconType = isSuccess ? 'CheckCircle2' : 'AlertCircle';

  return {
    isSuccess,
    message,
    color,
    iconType,
    hasEmoji: /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(message),
  };
}

const mockTheme = {
  isDark: false,
  numPos: '#1A7038',
  numNeg: '#B01830',
};

test('FormAlert: renders nothing when neither error nor success is provided', () => {
  const result = getAlertStyles({ theme: mockTheme, error: null, success: null });
  assert.equal(result, null);
});

test('FormAlert: renders error state with numNeg and AlertCircle icon', () => {
  const result = getAlertStyles({
    theme: mockTheme,
    error: 'Invalid email or password.',
    success: null,
  });
  assert.ok(result);
  assert.equal(result.isSuccess, false);
  assert.equal(result.color, mockTheme.numNeg);
  assert.equal(result.iconType, 'AlertCircle');
  assert.equal(result.message, 'Invalid email or password.');
  assert.equal(result.hasEmoji, false);
});

test('FormAlert: renders success state with numPos and CheckCircle2 icon without emojis', () => {
  const result = getAlertStyles({
    theme: mockTheme,
    error: null,
    success: 'Account created successfully. You can now sign in.',
  });
  assert.ok(result);
  assert.equal(result.isSuccess, true);
  assert.equal(result.color, mockTheme.numPos);
  assert.equal(result.iconType, 'CheckCircle2');
  assert.equal(result.message, 'Account created successfully. You can now sign in.');
  assert.equal(result.hasEmoji, false);
});

test('FormAlert: error takes precedence over success if both are unexpectedly set', () => {
  const result = getAlertStyles({
    theme: mockTheme,
    error: 'Something went wrong.',
    success: 'Account created successfully. You can now sign in.',
  });
  assert.ok(result);
  assert.equal(result.isSuccess, false);
  assert.equal(result.color, mockTheme.numNeg);
  assert.equal(result.iconType, 'AlertCircle');
  assert.equal(result.message, 'Something went wrong.');
});
