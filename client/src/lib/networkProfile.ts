import AsyncStorage from '@react-native-async-storage/async-storage';

const BIO_KEY = 'di-network-bio';

export async function loadNetworkBio(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(BIO_KEY)) ?? '';
  } catch {
    return '';
  }
}

export async function saveNetworkBio(bio: string): Promise<void> {
  try {
    await AsyncStorage.setItem(BIO_KEY, bio.trim().slice(0, 400));
  } catch {
    /* ignore */
  }
}
