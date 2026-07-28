import type { MarketGame, MarketSearchParam } from '@lzt/shared'
import { useTranslation } from 'react-i18next'
import { Dropdown } from '~/widgets/Dropdown/Dropdown'
import styles from './MarketView.module.scss'

export type FilterValues = Record<string, string>

interface Props {
  params: MarketSearchParam[]
  games: MarketGame[]
  values: FilterValues
  onChange: (name: string, value: string) => void
  onApply: () => void
  onReset: () => void
  loading: boolean
}

export const FilterPanel = ({
  params,
  games,
  values,
  onChange,
  onApply,
  onReset,
  loading,
}: Props) => {
  const { t, i18n } = useTranslation()
  const isEn = i18n.language.startsWith('en')

  return (
    <div className={styles.filters}>
      <div className={styles.filtersGrid}>
        {games.length > 0 ? (
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t('market.game')}</span>
            <Dropdown
              value={values['game[]'] ?? ''}
              onChange={(v) => onChange('game[]', v)}
              options={[
                { value: '', label: t('market.any') },
                ...games.map((game) => ({
                  value: String(game.app_id),
                  label: (isEn ? game.title : game.ru) || game.title,
                })),
              ]}
            />
          </label>
        ) : null}

        {params.map((param) => {
          const label = param.description || param.name
          const hasOptions = Boolean(param.values && param.values.length > 0)
          return (
            <label key={param.name} className={styles.field}>
              <span className={styles.fieldLabel}>{label}</span>
              {hasOptions ? (
                <Dropdown
                  value={values[param.name] ?? ''}
                  onChange={(v) => onChange(param.name, v)}
                  options={[
                    { value: '', label: t('market.any') },
                    ...(param.values ?? []).map((val) => ({
                      value: val,
                      label: val,
                    })),
                  ]}
                />
              ) : (
                <input
                  className={styles.fieldInput}
                  value={values[param.name] ?? ''}
                  onChange={(e) => onChange(param.name, e.target.value)}
                  spellCheck={false}
                />
              )}
            </label>
          )
        })}
      </div>

      <div className={styles.filtersActions}>
        <button
          type="button"
          className={styles.applyBtn}
          onClick={onApply}
          disabled={loading}
        >
          {t('market.apply')}
        </button>
        <button
          type="button"
          className={styles.resetBtn}
          onClick={onReset}
          disabled={loading}
        >
          {t('market.reset')}
        </button>
      </div>
    </div>
  )
}
