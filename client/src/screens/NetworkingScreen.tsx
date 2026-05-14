import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { useSession } from '../context/SessionProvider';
import { parseFriendTagFromQr } from '../lib/qrPayload';
import { addFriend, buildFriendQrPayload, loadFriends, type FriendEntry } from '../lib/friendsStore';
import {
  addChatMessage,
  addForumReply,
  addForumTopic,
  loadChatMessages,
  loadForumTopics,
  type ChatMessage,
  type ForumTopic,
} from '../lib/networkingStore';

function timeLabel(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function NetworkingScreen() {
  const insets = useSafeAreaInsets();
  const session = useSession();
  const guestId = session.status === 'ready' ? session.guestId : '';
  const displayName = session.status === 'ready' ? session.displayName || 'Collector' : 'Collector';
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [topics, setTopics] = useState<ForumTopic[]>([]);
  const [topicTitle, setTopicTitle] = useState('');
  const [topicBody, setTopicBody] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [perm, reqPerm] = useCameraPermissions();
  const [scanOpen, setScanOpen] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<FriendEntry | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const lastScan = useRef<{ t: number; d: string }>({ t: 0, d: '' });

  const friendPayload = useMemo(() => buildFriendQrPayload(guestId, displayName), [displayName, guestId]);

  const refreshFriends = useCallback(async () => {
    setFriends(await loadFriends());
  }, []);

  const refreshTopics = useCallback(async () => {
    setTopics(await loadForumTopics());
  }, []);

  useEffect(() => {
    void refreshFriends();
    void refreshTopics();
  }, [refreshFriends, refreshTopics]);

  useEffect(() => {
    const id = globalThis.setInterval(() => {
      void refreshTopics();
    }, 5000);
    return () => globalThis.clearInterval(id);
  }, [refreshTopics]);

  useEffect(() => {
    if (!selectedFriend) return;
    void loadChatMessages(selectedFriend.guestId).then(setChatMessages);
    const id = globalThis.setInterval(() => {
      void loadChatMessages(selectedFriend.guestId).then(setChatMessages);
    }, 5000);
    return () => globalThis.clearInterval(id);
  }, [selectedFriend]);

  const onFriendBarcode = useCallback(
    ({ data }: { data: string }) => {
      const now = Date.now();
      if (data === lastScan.current.d && now - lastScan.current.t < 2500) return;
      lastScan.current = { t: now, d: data };
      const tag = parseFriendTagFromQr(data);
      if (!tag) {
        setScanMsg('Not a collector tag.');
        return;
      }
      if (tag.guestId === guestId) {
        setScanMsg('That is your own collector tag.');
        return;
      }
      void (async () => {
        const r = await addFriend(tag.guestId, tag.displayName ?? 'Collector');
        await refreshFriends();
        if (!r.ok) setScanMsg(r.error ?? 'Could not add');
        else {
          setScanMsg(`Added ${tag.displayName ?? 'collector'} to friends.`);
          setScanOpen(false);
        }
      })();
    },
    [guestId, refreshFriends],
  );

  const publishTopic = async () => {
    const topic = await addForumTopic({
      authorId: guestId,
      authorName: displayName,
      title: topicTitle,
      body: topicBody,
    });
    if (!topic) return;
    setTopicTitle('');
    setTopicBody('');
    await refreshTopics();
  };

  const publishReply = async (topicId: string) => {
    const reply = await addForumReply({
      topicId,
      authorId: guestId,
      authorName: displayName,
      body: replyDrafts[topicId] ?? '',
    });
    if (!reply) return;
    setReplyDrafts((drafts) => ({ ...drafts, [topicId]: '' }));
    await refreshTopics();
  };

  const sendChat = async () => {
    if (!selectedFriend) return;
    const message = await addChatMessage({
      friendGuestId: selectedFriend.guestId,
      authorId: guestId,
      authorName: displayName,
      body: chatDraft,
    });
    if (!message) return;
    setChatDraft('');
    setChatMessages(await loadChatMessages(selectedFriend.guestId));
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <FlatList
        data={topics}
        keyExtractor={(topic) => topic.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        ListHeaderComponent={(
          <>
            <View style={styles.profileCard}>
              <View style={styles.hero}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{displayName.slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={styles.heroCopy}>
                  <Text style={styles.title} numberOfLines={1}>{displayName}</Text>
                </View>
              </View>

              <View style={styles.sharePanel}>
                <View style={styles.shareCopy}>
                  <Text style={styles.muted}>Let another guest scan this to add you as a friend.</Text>
                </View>
                {guestId ? (
                  <View style={styles.qrMini}>
                    <QRCode value={friendPayload} size={96} backgroundColor="#151518" color="#f5f0e6" />
                  </View>
                ) : null}
              </View>

              <Pressable style={styles.primaryAction} onPress={() => setScanOpen(true)}>
                <Ionicons name="qr-code-outline" color="#1a1208" size={18} />
                <Text style={styles.primaryText}>Scan Friend QR</Text>
              </Pressable>
            </View>
            {scanMsg ? <Text style={styles.msg}>{scanMsg}</Text> : null}

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.h}>Friends</Text>
                <Text style={styles.count}>{friends.length}</Text>
              </View>
              {friends.length === 0 ? (
                <View style={styles.emptyCardFull}>
                  <Ionicons name="people-outline" color="#c9a962" size={22} />
                  <View style={styles.emptyCopy}>
                    <Text style={styles.emptyTitle}>No friends yet</Text>
                    <Text style={styles.muted}>Scan a collector QR to start a direct chat.</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.friendList}>
                  {friends.map((f) => (
                    <Pressable key={f.guestId} style={({ pressed }) => [styles.friendCard, pressed && styles.pressed]} onPress={() => setSelectedFriend(f)}>
                      <View style={styles.friendAvatar}>
                        <Text style={styles.friendAvatarText}>{f.displayName.slice(0, 1).toUpperCase()}</Text>
                      </View>
                      <View style={styles.friendCopy}>
                        <Text style={styles.friendName} numberOfLines={1}>{f.displayName}</Text>
                        <Text style={styles.friendHint}>Tap to chat</Text>
                      </View>
                      <Ionicons name="chatbubble-ellipses-outline" color="#c9a962" size={20} />
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.h}>Forum</Text>
              <Text style={styles.count}>{topics.length}</Text>
            </View>
          </>
        )}
        ListEmptyComponent={(
          <View style={styles.emptyCardFull}>
            <Ionicons name="chatbubbles-outline" color="#c9a962" size={22} />
            <View style={styles.emptyCopy}>
              <Text style={styles.emptyTitle}>Start the first thread</Text>
              <Text style={styles.muted}>Topics can be used for meetups, artwork reactions, or collector questions.</Text>
            </View>
          </View>
        )}
        renderItem={({ item: topic }) => (
          <View style={styles.topicCard}>
              <View style={styles.topicMeta}>
                <Text style={styles.topicAuthor}>{topic.authorName}</Text>
                <Text style={styles.topicTime}>{timeLabel(topic.createdAt)}</Text>
              </View>
              <Text style={styles.topicTitle}>{topic.title}</Text>
              {topic.body ? <Text style={styles.topicBodyText}>{topic.body}</Text> : null}
              {topic.replies.map((reply) => (
                <View key={reply.id} style={styles.reply}>
                  <Text style={styles.replyMeta}>{reply.authorName} - {timeLabel(reply.createdAt)}</Text>
                  <Text style={styles.replyBody}>{reply.body}</Text>
                </View>
              ))}
              <View style={styles.replyComposer}>
                <TextInput
                  style={[styles.input, styles.replyInput]}
                  value={replyDrafts[topic.id] ?? ''}
                  onChangeText={(v) => setReplyDrafts((drafts) => ({ ...drafts, [topic.id]: v }))}
                  placeholder="Reply..."
                  placeholderTextColor="#6e6e73"
                />
                <Pressable style={styles.replyButton} onPress={() => void publishReply(topic.id)}>
                  <Ionicons name="arrow-up" color="#1a1208" size={16} />
                </Pressable>
              </View>
            </View>
        )}
        ListFooterComponent={(
          <View style={[styles.card, styles.composerCard]}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.h}>Publish Topic</Text>
                <Text style={styles.muted}>Start a public thread for guests to reply.</Text>
              </View>
              <Ionicons name="megaphone-outline" color="#c9a962" size={22} />
            </View>
            <TextInput
              style={styles.input}
              value={topicTitle}
              onChangeText={setTopicTitle}
              placeholder="Topic title"
              placeholderTextColor="#6e6e73"
            />
            <TextInput
              style={[styles.input, styles.topicBody]}
              multiline
              value={topicBody}
              onChangeText={setTopicBody}
              placeholder="Share a thought, question, or meetup idea..."
              placeholderTextColor="#6e6e73"
            />
            <Pressable style={styles.primaryAction} onPress={publishTopic}>
              <Ionicons name="send" color="#1a1208" size={16} />
              <Text style={styles.primaryText}>Publish</Text>
            </Pressable>
          </View>
        )}
      />

      <Modal visible={scanOpen} animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {!perm?.granted ? (
            <View style={[styles.center, { paddingTop: insets.top }]}>
              <Text style={styles.scanTitle}>Scan Collector QR</Text>
              <Text style={styles.muted}>Camera permission is required to add a friend.</Text>
              <Pressable style={styles.primaryAction} onPress={() => void reqPerm()}>
                <Text style={styles.primaryText}>Allow</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <CameraView
                style={{ flex: 1 }}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={onFriendBarcode}
              />
              <View pointerEvents="none" style={styles.scanOverlay}>
                <Text style={styles.scanTitle}>Scan Collector QR</Text>
                <View style={styles.scanFrame} />
              </View>
            </>
          )}
          <Pressable style={[styles.close, { bottom: insets.bottom + 16 }]} onPress={() => setScanOpen(false)}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
      </Modal>

      <Modal visible={!!selectedFriend} animationType="slide" onRequestClose={() => setSelectedFriend(null)}>
        <View style={[styles.chatRoot, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.chatHeader}>
            <Pressable style={styles.iconButton} onPress={() => setSelectedFriend(null)}>
              <Ionicons name="chevron-back" color="#f5f0e6" size={22} />
            </Pressable>
            <View>
              <Text style={styles.chatTitle}>{selectedFriend?.displayName}</Text>
              <Text style={styles.chatSubtitle}>Direct chat</Text>
            </View>
          </View>
          <ScrollView contentContainerStyle={styles.messages}>
            {chatMessages.length === 0 ? (
              <View style={styles.emptyChat}>
                <Text style={styles.emptyTitle}>Say hello</Text>
                <Text style={styles.muted}>Messages are saved securely for the event.</Text>
              </View>
            ) : (
              chatMessages.map((m) => (
                <View key={m.id} style={styles.messageBubble}>
                  <Text style={styles.messageMeta}>{m.authorName} - {timeLabel(m.createdAt)}</Text>
                  <Text style={styles.messageText}>{m.body}</Text>
                </View>
              ))
            )}
          </ScrollView>
          <View style={styles.chatComposer}>
            <TextInput
              style={[styles.input, styles.chatInput]}
              value={chatDraft}
              onChangeText={setChatDraft}
              placeholder="Message..."
              placeholderTextColor="#6e6e73"
            />
            <Pressable style={styles.sendButton} onPress={sendChat}>
              <Ionicons name="send" color="#1a1208" size={17} />
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0b' },
  scroll: { paddingHorizontal: 18, paddingTop: 12, gap: 18 },
  profileCard: {
    backgroundColor: '#121214',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#242428',
    gap: 16,
  },
  hero: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#c9a962', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#1a1208', fontSize: 24, fontWeight: '800' },
  heroCopy: { flex: 1 },
  title: { color: '#f5f0e6', fontSize: 27, fontWeight: '700', fontFamily: 'serif', marginTop: 2 },
  sharePanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 20,
    backgroundColor: '#0d0d0f',
    borderWidth: 1,
    borderColor: '#242428',
  },
  shareCopy: { flex: 1, gap: 4 },
  qrMini: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: '#151518',
    borderWidth: 1,
    borderColor: '#2a2a2e',
  },
  section: { gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: { color: '#c9a962', fontWeight: '700' },
  card: { backgroundColor: '#121214', borderRadius: 22, padding: 16, borderWidth: 1, borderColor: '#242428', gap: 12 },
  composerCard: { marginTop: 4 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  h: { color: '#f5f0e6', fontSize: 19, fontWeight: '700' },
  label: { color: '#9a968e', fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: '#3a3a40',
    borderRadius: 10,
    padding: 12,
    color: '#f5f0e6',
    backgroundColor: '#0d0d0f',
  },
  topicBody: { minHeight: 88, textAlignVertical: 'top' },
  primaryAction: {
    backgroundColor: '#c9a962',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    alignSelf: 'stretch',
  },
  primaryText: { color: '#1a1208', fontWeight: '700' },
  muted: { color: '#8a8a8f', lineHeight: 18 },
  emptyCardFull: {
    width: '100%',
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#121214',
    borderWidth: 1,
    borderColor: '#242428',
  },
  emptyCopy: { flex: 1 },
  emptyTitle: { color: '#f5f0e6', fontWeight: '700', marginBottom: 4 },
  friendList: { gap: 10 },
  friendCard: {
    width: '100%',
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#121214',
    borderWidth: 1,
    borderColor: '#242428',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  friendAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2c261a', alignItems: 'center', justifyContent: 'center' },
  friendAvatarText: { color: '#c9a962', fontWeight: '800', fontSize: 18 },
  friendCopy: { flex: 1 },
  friendName: { color: '#f5f0e6', fontWeight: '700' },
  friendHint: { color: '#8a8a8f', fontSize: 12, marginTop: 3 },
  pressed: { opacity: 0.88, transform: [{ translateY: 1 }] },
  msg: { color: '#c9c5bc', marginTop: -8, marginHorizontal: 4 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  scanOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 24 },
  scanTitle: { color: '#f5f0e6', fontSize: 22, fontWeight: '700', fontFamily: 'serif' },
  scanFrame: { width: 230, height: 230, borderRadius: 28, borderWidth: 2, borderColor: '#c9a962', backgroundColor: 'rgba(0,0,0,0.08)' },
  close: { position: 'absolute', alignSelf: 'center', backgroundColor: '#2a2a32', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  closeText: { color: '#f5f0e6', fontWeight: '600' },
  topicCard: { backgroundColor: '#121214', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#242428', marginBottom: 12 },
  topicMeta: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  topicAuthor: { color: '#c9a962', fontWeight: '700' },
  topicTime: { color: '#6e6e73', fontSize: 12 },
  topicTitle: { color: '#f5f0e6', fontSize: 17, fontWeight: '800', marginTop: 8 },
  topicBodyText: { color: '#c9c5bc', lineHeight: 20, marginTop: 6 },
  reply: { marginTop: 12, padding: 12, borderRadius: 14, backgroundColor: '#0d0d0f', borderWidth: 1, borderColor: '#242428' },
  replyMeta: { color: '#8f8a82', fontSize: 12, marginBottom: 4 },
  replyBody: { color: '#f5f0e6', lineHeight: 19 },
  replyComposer: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 12 },
  replyInput: { flex: 1, minHeight: 44, paddingVertical: 10 },
  replyButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#c9a962', alignItems: 'center', justifyContent: 'center' },
  chatRoot: { flex: 1, backgroundColor: '#0a0a0b' },
  chatHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#242428' },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#151518' },
  chatTitle: { color: '#f5f0e6', fontSize: 18, fontWeight: '800' },
  chatSubtitle: { color: '#8f8a82', fontSize: 12 },
  messages: { padding: 16, gap: 10, flexGrow: 1 },
  emptyChat: { alignSelf: 'center', marginTop: 80, alignItems: 'center' },
  messageBubble: { alignSelf: 'flex-end', maxWidth: '86%', backgroundColor: '#1f1a11', borderWidth: 1, borderColor: 'rgba(201,169,98,0.35)', borderRadius: 18, padding: 12 },
  messageMeta: { color: '#c9a962', fontSize: 12, marginBottom: 4 },
  messageText: { color: '#f5f0e6', lineHeight: 19 },
  chatComposer: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#242428' },
  chatInput: { flex: 1, minHeight: 46 },
  sendButton: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#c9a962', alignItems: 'center', justifyContent: 'center' },
});
