import { NextResponse } from 'next/server'
import { validateAuth } from '../_auth'

export async function POST(request) {
  const authErr = validateAuth(request)
  if (authErr) return authErr

  try {
    const SLACK_CHANNEL = process.env.SLACK_CHANNEL
    if (!SLACK_CHANNEL) {
      return NextResponse.json({ error: 'SLACK_CHANNEL no configurado en variables de entorno' }, { status: 500 })
    }

    const slackToken = process.env.SLACK_BOT_TOKEN
    if (!slackToken) {
      return NextResponse.json({ error: 'SLACK_BOT_TOKEN no configurado' }, { status: 500 })
    }

    const { text, channel } = await request.json()
    if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 })

    // Slack limita a 40,000 chars por mensaje — truncar si excede
    const safeText = text.length > 39000
      ? text.slice(0, 38900) + '\n\n... [minuta truncada — ver dashboard para versión completa]'
      : text

    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${slackToken}`,
      },
      body: JSON.stringify({
        channel: channel || SLACK_CHANNEL,
        text: safeText,
        mrkdwn: true,
      }),
    })

    const data = await res.json()
    if (!data.ok) throw new Error(data.error || 'Slack API error')
    return NextResponse.json({ success: true, ts: data.ts })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
