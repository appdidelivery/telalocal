"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import {
  listCampaigns,
  updateCampaignDelivery,
  type CampaignRecord,
  type CampaignTargetMode,
} from "@/lib/firebase/campaigns";
import {
  getTenantContext,
  listScreens,
  type ScreenRecord,
} from "@/lib/firebase/screens";
import { campaignMatchesScreen } from "@/lib/firebase/playlists";

const WEEKDAYS = [
  ["0", "Dom"],
  ["1", "Seg"],
  ["2", "Ter"],
  ["3", "Qua"],
  ["4", "Qui"],
  ["5", "Sex"],
  ["6", "Sáb"],
] as const;

function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function DeliveryPlanningClient() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [screens, setScreens] = useState<ScreenRecord[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [slotSeconds, setSlotSeconds] = useState<15 | 30>(15);
  const [budgetCredits, setBudgetCredits] = useState(10);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [days, setDays] = useState<number[]>([]);
  const [targetMode, setTargetMode] =
    useState<CampaignTargetMode>("all");
  const [categories, setCategories] = useState("");
  const [cities, setCities] = useState("");
  const [zipCodes, setZipCodes] = useState("");
  const [screenIds, setScreenIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      try {
        const context = await getTenantContext();
        const [campaignList, screenList] = await Promise.all([
          listCampaigns(),
          listScreens(context),
        ]);
        setCampaigns(campaignList);
        setScreens(screenList);
        if (campaignList[0]) setCampaignId(campaignList[0].id);
      } catch {
        setError("Não foi possível carregar o planejamento.");
      } finally {
        setLoading(false);
      }
    });
  }, [router]);

  const selectedCampaign = useMemo(
    () => campaigns.find((item) => item.id === campaignId) ?? null,
    [campaignId, campaigns]
  );

  useEffect(() => {
    if (!selectedCampaign) return;

    setSlotSeconds(selectedCampaign.slotSeconds ?? 15);
    setBudgetCredits(selectedCampaign.budgetCredits ?? 10);
    setScheduleEnabled(Boolean(selectedCampaign.scheduleEnabled));
    setStartDate(selectedCampaign.scheduleStartDate ?? "");
    setEndDate(selectedCampaign.scheduleEndDate ?? "");
    setStartTime(selectedCampaign.scheduleStartTime ?? "");
    setEndTime(selectedCampaign.scheduleEndTime ?? "");
    setDays(selectedCampaign.scheduleDays ?? []);
    setTargetMode(selectedCampaign.targetMode ?? "all");
    setCategories((selectedCampaign.targetCategories ?? []).join(", "));
    setCities((selectedCampaign.targetCities ?? []).join(", "));
    setZipCodes((selectedCampaign.targetZipCodes ?? []).join(", "));
    setScreenIds(selectedCampaign.targetScreenIds ?? []);
    setMessage("");
    setError("");
  }, [selectedCampaign]);

  const previewCampaign = useMemo<CampaignRecord | null>(() => {
    if (!selectedCampaign) return null;

    return {
      ...selectedCampaign,
      targetMode,
      targetCategories: splitList(categories),
      targetCities: splitList(cities),
      targetZipCodes: splitList(zipCodes),
      targetScreenIds: screenIds,
    };
  }, [
    categories,
    cities,
    screenIds,
    selectedCampaign,
    targetMode,
    zipCodes,
  ]);

  const matchingScreens = useMemo(() => {
    if (!previewCampaign) return [];
    return screens.filter((screen) =>
      campaignMatchesScreen(previewCampaign, screen)
    );
  }, [previewCampaign, screens]);

  function toggleDay(day: number) {
    setDays((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day].sort()
    );
  }

  function toggleScreen(id: string) {
    setScreenIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCampaign) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const delivery = await updateCampaignDelivery(selectedCampaign.id, {
        slotSeconds,
        budgetCredits,
        scheduleEnabled,
        scheduleStartDate: startDate,
        scheduleEndDate: endDate,
        scheduleDays: days,
        scheduleStartTime: startTime,
        scheduleEndTime: endTime,
        targetMode,
        targetCategories: splitList(categories),
        targetCities: splitList(cities),
        targetZipCodes: splitList(zipCodes),
        targetScreenIds: screenIds,
      });

      setCampaigns((current) =>
        current.map((item) =>
          item.id === selectedCampaign.id
            ? { ...item, ...delivery }
            : item
        )
      );
      setMessage(
        "Planejamento salvo. Republique a playlist ou use Publicar segmentação para enviar às TVs."
      );
    } catch {
      setError("Não foi possível salvar o planejamento.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="auth-loading">
        <p className="muted">Carregando planejamento...</p>
      </main>
    );
  }

  return (
    <main className="panel-page wrap">
      <div className="panel-page-header">
        <div>
          <div className="eyebrow">VEICULAÇÃO</div>
          <h1>Agendamento e segmentação</h1>
          <p className="muted">
            Defina quando a campanha roda e quais telas devem recebê-la.
          </p>
        </div>
        <div className="screen-actions">
          <Link className="btn primary" href="/painel/playlists">
            Publicar playlists
          </Link>
          <Link className="btn ghost" href="/painel">
            ← Voltar
          </Link>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <div className="empty-state">
          <strong>Nenhuma campanha cadastrada.</strong>
          <p><Link href="/painel/campanhas">Criar campanha →</Link></p>
        </div>
      ) : (
        <form className="planning-layout" onSubmit={handleSubmit}>
          <section className="card">
            <h2>Campanha</h2>
            <div className="field">
              <label htmlFor="planning-campaign">Selecionar</label>
              <select
                id="planning-campaign"
                value={campaignId}
                onChange={(event) => setCampaignId(event.target.value)}
              >
                {campaigns.map((campaign) => (
                  <option value={campaign.id} key={campaign.id}>
                    {campaign.name} · {campaign.advertiserName}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="planning-slot">Formato comercial</label>
              <select
                id="planning-slot"
                value={slotSeconds}
                onChange={(event) =>
                  setSlotSeconds(Number(event.target.value) as 15 | 30)
                }
              >
                <option value={15}>15 segundos</option>
                <option value={30}>30 segundos</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="planning-budget">Orçamento em créditos</label>
              <input
                id="planning-budget"
                type="number"
                min={0}
                max={100}
                value={budgetCredits}
                onChange={(event) =>
                  setBudgetCredits(Math.max(0, Number(event.target.value || 0)))
                }
              />
              <small className="file-summary">
                No piloto, os créditos servem para distribuir o orçamento entre campanhas. A compra automática será ligada ao gateway na fase comercial.
              </small>
            </div>

            <h2 className="planning-section-title">Agendamento</h2>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={scheduleEnabled}
                onChange={(event) => setScheduleEnabled(event.target.checked)}
              />
              <span>
                <strong>Usar programação</strong>
                <small>Fora da faixa, a TV pula esta campanha automaticamente.</small>
              </span>
            </label>

            {scheduleEnabled ? (
              <>
                <div className="field-row">
                  <div className="field">
                    <label>Data inicial</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Data final</label>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                </div>

                <div className="field-row">
                  <div className="field">
                    <label>Horário inicial</label>
                    <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Horário final</label>
                    <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                  </div>
                </div>

                <div className="field">
                  <label>Dias da semana</label>
                  <div className="weekday-grid">
                    {WEEKDAYS.map(([value, label]) => {
                      const day = Number(value);
                      return (
                        <button
                          key={value}
                          type="button"
                          className={days.includes(day) ? "weekday active" : "weekday"}
                          onClick={() => toggleDay(day)}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <small className="file-summary">Nenhum dia marcado = todos os dias.</small>
                </div>
              </>
            ) : null}
          </section>

          <section className="card">
            <h2>Segmentação</h2>
            <div className="field">
              <label htmlFor="target-mode">Enviar para</label>
              <select
                id="target-mode"
                value={targetMode}
                onChange={(event) =>
                  setTargetMode(event.target.value as CampaignTargetMode)
                }
              >
                <option value="all">Todas as telas</option>
                <option value="category">Categoria</option>
                <option value="city">Cidade</option>
                <option value="zip">CEP</option>
                <option value="screens">Telas específicas</option>
              </select>
            </div>

            {targetMode === "category" ? (
              <div className="field">
                <label>Categorias</label>
                <input value={categories} onChange={(e) => setCategories(e.target.value)} placeholder="Barbearia, Academia" />
                <small className="file-summary">Separe por vírgulas.</small>
              </div>
            ) : null}

            {targetMode === "city" ? (
              <div className="field">
                <label>Cidades</label>
                <input value={cities} onChange={(e) => setCities(e.target.value)} placeholder="Florianópolis, São José" />
              </div>
            ) : null}

            {targetMode === "zip" ? (
              <div className="field">
                <label>CEPs</label>
                <input value={zipCodes} onChange={(e) => setZipCodes(e.target.value)} placeholder="88000-000, 88100-000" />
              </div>
            ) : null}

            {targetMode === "screens" ? (
              <div className="target-screen-list">
                {screens.map((screen) => (
                  <label key={screen.id} className="campaign-option">
                    <input
                      type="checkbox"
                      checked={screenIds.includes(screen.id)}
                      onChange={() => toggleScreen(screen.id)}
                    />
                    <span>
                      <strong>{screen.pointName} · {screen.screenName}</strong>
                      <small>{screen.category} · {screen.city}/{screen.state}</small>
                    </span>
                  </label>
                ))}
              </div>
            ) : null}

            <div className="target-preview">
              <span className="muted">Alcance atual</span>
              <strong>{matchingScreens.length} tela(s)</strong>
              {matchingScreens.slice(0, 5).map((screen) => (
                <small key={screen.id}>
                  {screen.pointName} · {screen.screenName}
                </small>
              ))}
            </div>

            {error ? <p className="message error">{error}</p> : null}
            {message ? <p className="message success">{message}</p> : null}

            <button className="btn primary full" disabled={saving} type="submit">
              {saving ? "Salvando..." : "Salvar planejamento"}
            </button>
          </section>
        </form>
      )}
    </main>
  );
}
