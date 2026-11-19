import { useSearchParams } from 'react-router-dom';
import SupportAnalytics from '../components/support/SupportAnalytics.jsx';
import SupportConversations from '../components/support/SupportConversations.jsx';

// Admin Support Center (/admin/support). Two views, kept in the URL so each
// is linkable and the browser Back button works:
//   default            — Conversations (live agent chat)
//   ?view=analytics    — Chat Logs & Analytics ("Show Analytics" button)
//   ?chat=<ticketId>   — Conversations with that chat open (used by the
//                        analytics drawer's "Reply in Conversations")
export default function Support() {
  const [params, setParams] = useSearchParams();

  if (params.get('view') === 'analytics') {
    return <SupportAnalytics onBack={() => setParams({})} onOpenInChat={(id) => setParams({ chat: id })} />;
  }

  const chatId = params.get('chat');
  return <SupportConversations key={chatId || 'inbox'} initialChatId={chatId} onShowAnalytics={() => setParams({ view: 'analytics' })} />;
}
