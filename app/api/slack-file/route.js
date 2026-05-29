import { NextResponse } from 'next/server'
import { validateAuth } from '../_auth'

export const runtime = 'nodejs'

export async function POST(request) {
  const authErr = validateAuth(request)
  if (authErr) return authErr

  try {
    const SLACK_CHANNEL = process.env.SLACK_CHANNEL
    const slackToken = process.env.SLACK_BOT_TOKEN
    if (!SLACK_CHANNEL) return NextResponse.json({ error: 'SLACK_CHANNEL no configurado' }, { status: 500 })
    if (!slackToken) return NextResponse.json({ error: 'SLACK_BOT_TOKEN no configurado' }, { status: 500 })

    const formData = await request.formData()
    const file = formData.get('file')
    const initialComment = formData.get('initial_comment') || ''
    const channel = formData.get('channel') || SLACK_CHANNEL

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'file required' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const filename = file.name || 'minuta.png'
    const length = buffer.byteLength

    // 1) Reservar URL de subida (POST + form-urlencoded es lo más confiable)
    const upUrlBody = new URLSearchParams({ filename, length: String(length) })
    const upUrlRes = await fetch('https://slack.com/api/files.getUploadURLExternal', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${slackToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: upUrlBody,
    })
    const upUrlData = await upUrlRes.json()
    console.log('[slack-file] getUploadURLExternal:', upUrlData)
    if (!upUrlData.ok) {
      return NextResponse.json({
        error: `getUploadURLExternal: ${upUrlData.error || 'desconocido'}`,
        slack: upUrlData,
      }, { status: 500 })
    }
    const { upload_url, file_id } = upUrlData

    // 2) Subir los bytes
    const uploadRes = await fetch(upload_url, {
      method: 'POST',
      body: buffer,
      headers: { 'Content-Type': 'application/octet-stream' },
    })
    if (!uploadRes.ok) {
      const txt = await uploadRes.text().catch(() => '')
      console.log('[slack-file] upload bytes failed:', uploadRes.status, txt)
      return NextResponse.json({ error: `upload bytes: HTTP ${uploadRes.status}`, body: txt }, { status: 500 })
    }

    // 3) Finalizar + publicar en canal
    const completeRes = await fetch('https://slack.com/api/files.completeUploadExternal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${slackToken}`,
      },
      body: JSON.stringify({
        files: [{ id: file_id, title: filename }],
        channel_id: channel,
        initial_comment: initialComment,
      }),
    })
    const completeData = await completeRes.json()
    console.log('[slack-file] completeUploadExternal:', completeData)
    if (!completeData.ok) {
      return NextResponse.json({
        error: `completeUploadExternal: ${completeData.error || 'desconocido'}`,
        slack: completeData,
      }, { status: 500 })
    }

    return NextResponse.json({ success: true, file_id })
  } catch (error) {
    console.error('[slack-file] exception:', error)
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 })
  }
}
