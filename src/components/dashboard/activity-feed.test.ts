import { describe, expect, it } from 'vitest'
import { translateActivityText } from './activity-feed'

describe('translateActivityText', () => {
  const dictionary: Record<string, string> = {
    'new message from': 'Nouveau message de',
    'new contact': 'Nouveau contact',
    'deal': 'Opportunité',
    'in': 'dans',
    'updated': 'mise à jour',
    'broadcast': 'Diffusion',
    'sent to': 'envoyée à',
    'recipients': 'destinataires',
    'contacts': 'contacts',
    'automation': 'Automatisation',
    'failed for': 'a échoué pour',
    'triggered for': 'déclenchée pour',
    'draft': 'brouillon',
    'proposal': 'proposition',
  }

  const tMock = (text: string): string => {
    const normalized = text.toLowerCase().trim()
    return dictionary[normalized] || text
  }

  it('translates "New message from <who>" correctly', () => {
    expect(translateActivityText('New message from Alice', tMock)).toBe(
      'Nouveau message de Alice'
    )
  })

  it('translates "New contact: <who>" correctly', () => {
    expect(translateActivityText('New contact: Bob', tMock)).toBe(
      'Nouveau contact: Bob'
    )
  })

  it('translates "Deal <title> in <stage>" correctly', () => {
    expect(translateActivityText('Deal "Acme Corp" in Proposal', tMock)).toBe(
      'Opportunité "Acme Corp" dans proposition'
    )
  })

  it('translates "Deal <title> updated" correctly', () => {
    expect(translateActivityText('Deal "Big Deal" updated', tMock)).toBe(
      'Opportunité "Big Deal" mise à jour'
    )
  })

  it('translates "Broadcast <name> sent to <count> contacts" correctly', () => {
    expect(translateActivityText('Broadcast "May Newsletter" sent to 150 contacts', tMock)).toBe(
      'Diffusion "May Newsletter" envoyée à 150 contacts'
    )
  })

  it('translates "Broadcast <name> <status> (<count> recipients)" correctly', () => {
    expect(translateActivityText('Broadcast "Promo" draft (42 recipients)', tMock)).toBe(
      'Diffusion "Promo" brouillon (42 destinataires)'
    )
  })

  it('translates "Automation <name> failed for <who>" correctly', () => {
    expect(translateActivityText('Automation "Welcome Email" failed for Charlie', tMock)).toBe(
      'Automatisation "Welcome Email" a échoué pour Charlie'
    )
  })

  it('translates "Automation <name> triggered for <who>" correctly', () => {
    expect(translateActivityText('Automation "Follow Up" triggered for David', tMock)).toBe(
      'Automatisation "Follow Up" déclenchée pour David'
    )
  })

  it('returns original/fallback translation for unmatched strings', () => {
    expect(translateActivityText('Unknown activity text', tMock)).toBe(
      'Unknown activity text'
    )
  })
})
