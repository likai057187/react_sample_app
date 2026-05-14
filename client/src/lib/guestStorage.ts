import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'di-guest-id-v1';

export async function getStoredGuestId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function setStoredGuestId(id: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
}
