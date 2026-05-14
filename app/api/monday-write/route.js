import { NextResponse } from 'next/server'
import { validateAuth } from '../_auth'
import { MONDAY_USERS } from '../../lib/server-constants'

const MONDAY_API_URL = 'https://api.monday.com/v2'
const BOARD_ID = process.env.MONDAY_BOARD_ID || '18044324200'
const GROUP_ACUERDOS = 'group_mm1mhsd1'

export async function POST(request) {
  const authErr = validateAuth(request)
  if (authErr) return authErr

  try {
    const apiKey = process.env.MONDAY_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'No API key' }, { status: 500 })

    const { name, dateStr, personId, personName } = await request.json()
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

    // Resolver personId: acepta ID directo o nombre para resolver server-side
    const resolvedPersonId = personId || (personName ? MONDAY_USERS[personName] : null)

    let colVals = `"color_mkz09na": {"label": "🚧 Sprint"}`
    if (dateStr) {
      colVals += `, "timerange_mkzcqv0j": {"from": "${dateStr}", "to": "${dateStr}"}`
    }
    if (resolvedPersonId) {
      colVals += `, "person": {"personsAndTeams": [{"id": ${resolvedPersonId}, "kind": "person"}]}`
    }

    const mutation = `
      mutation {
        create_item(
          board_id: ${BOARD_ID},
          group_id: "${GROUP_ACUERDOS}",
          item_name: ${JSON.stringify(name)},
          column_values: ${JSON.stringify("{" + colVals + "}")}
        ) { id name }
      }
    `

    const res = await fetch(MONDAY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey,
        'API-Version': '2024-01',
      },
      body: JSON.stringify({ query: mutation }),
    })
    const data = await res.json()
    if (data.errors) throw new Error(data.errors[0]?.message)
    return NextResponse.json({ success: true, item: data.data?.create_item })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
