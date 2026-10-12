export const NATIONALITY_VALUES = [
  'Afghan',
  'Albanian',
  'Algerian',
  'American',
  'Argentinian',
  'Armenian',
  'Australian',
  'Austrian',
  'Azerbaijani',
  'Bangladeshi',
  'Belgian',
  'Brazilian',
  'British',
  'Bulgarian',
  'Canadian',
  'Chinese',
  'Colombian',
  'Croatian',
  'Czech',
  'Danish',
  'Dutch',
  'Egyptian',
  'Emirati',
  'English',
  'Estonian',
  'Finnish',
  'French',
  'Georgian',
  'German',
  'Greek',
  'Hungarian',
  'Indian',
  'Indonesian',
  'Iranian',
  'Iraqi',
  'Irish',
  'Israeli',
  'Italian',
  'Japanese',
  'Jordanian',
  'Kazakh',
  'Kuwaiti',
  'Kyrgyz',
  'Lebanese',
  'Malaysian',
  'Mexican',
  'Moroccan',
  'Norwegian',
  'Pakistani',
  'Palestinian',
  'Polish',
  'Portuguese',
  'Qatari',
  'Romanian',
  'Russian',
  'Saudi',
  'Serbian',
  'Spanish',
  'Swedish',
  'Swiss',
  'Syrian',
  'Tajik',
  'Tunisian',
  'Turkish',
  'Turkmen',
  'Ukrainian',
  'Uzbek',
  'Other',
] as const

export type NationalityValue = (typeof NATIONALITY_VALUES)[number]

type NationalityLabelResolver = (value: NationalityValue) => string

export function getNationalityOptions(
  labelFor: NationalityLabelResolver,
  currentValue?: string | null,
) {
  const options = NATIONALITY_VALUES.map((value) => ({
    value,
    label: labelFor(value),
  }))

  if (currentValue && !options.some((option) => option.value === currentValue)) {
    return [{ value: currentValue, label: currentValue }, ...options]
  }

  return options
}
