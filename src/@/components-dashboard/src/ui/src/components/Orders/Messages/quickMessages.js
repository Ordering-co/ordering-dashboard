const isPlaceholder = (text) => !text || /_message_\d+$/i.test(text.trim())

export const getQuickMessages = (level, t) => {
  const messages = {
    0: [
      { key: 'message_1', text: t('ADMIN_MESSAGE_1', 'admin_message_1') },
      { key: 'message_2', text: t('ADMIN_MESSAGE_2', 'admin_message_2') },
      { key: 'message_3', text: t('ADMIN_MESSAGE_3', 'admin_message_3') },
      { key: 'message_4', text: t('ADMIN_MESSAGE_4', 'admin_message_4') }
    ],
    2: [
      { key: 'message_1', text: t('STORE_MESSAGE_1', 'store_message_1') },
      { key: 'message_2', text: t('STORE_MESSAGE_2', 'store_message_2') },
      { key: 'message_3', text: t('STORE_MESSAGE_3', 'store_message_3') },
      { key: 'message_4', text: t('STORE_MESSAGE_4', 'store_message_4') }
    ]
  }
  return (messages[level] || []).filter(item => !isPlaceholder(item.text))
}
