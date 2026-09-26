import { FormEvent, useState } from "react";
import type { FoundationInput } from "../types/foundation";
import { REGIONS } from "../types/foundation";

const defaultInput: FoundationInput = {
  soil_type: "sandy_loam",
  bearing_capacity: "medium",
  groundwater_level: "medium",
  floors: 2,
  building_area_m2: 120,
  wall_material: "aerated_concrete",
  region: "ekb",
  seismicity: "0-6",
};

interface Props {
  onSubmit: (data: FoundationInput) => void;
  loading?: boolean;
}

export function InputForm({ onSubmit, loading }: Props) {
  const [form, setForm] = useState<FoundationInput>(defaultInput);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(form);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Исходные данные</h2>

      <label className="block text-sm">
        Тип грунта
        <select
          className="mt-1 w-full rounded border px-3 py-2"
          value={form.soil_type}
          onChange={(e) => setForm({ ...form, soil_type: e.target.value as FoundationInput["soil_type"] })}
        >
          <option value="sand">Песок</option>
          <option value="sandy_loam">Супесь</option>
          <option value="loam">Суглинок</option>
          <option value="clay">Глина</option>
          <option value="fill">Насыпной</option>
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          Несущая способность
          <select
            className="mt-1 w-full rounded border px-3 py-2"
            value={form.bearing_capacity}
            onChange={(e) =>
              setForm({ ...form, bearing_capacity: e.target.value as FoundationInput["bearing_capacity"] })
            }
          >
            <option value="low">Низкая</option>
            <option value="medium">Средняя</option>
            <option value="high">Высокая</option>
          </select>
        </label>
        <label className="block text-sm">
          Уровень грунтовых вод
          <select
            className="mt-1 w-full rounded border px-3 py-2"
            value={form.groundwater_level}
            onChange={(e) =>
              setForm({ ...form, groundwater_level: e.target.value as FoundationInput["groundwater_level"] })
            }
          >
            <option value="low">Низкий</option>
            <option value="medium">Средний</option>
            <option value="high">Высокий</option>
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          Этажность
          <input
            type="number"
            min={1}
            max={10}
            className="mt-1 w-full rounded border px-3 py-2"
            value={form.floors}
            onChange={(e) => setForm({ ...form, floors: Number(e.target.value) })}
          />
        </label>
        <label className="block text-sm">
          Площадь здания, м²
          <input
            type="number"
            min={1}
            step={1}
            className="mt-1 w-full rounded border px-3 py-2"
            value={form.building_area_m2}
            onChange={(e) => setForm({ ...form, building_area_m2: Number(e.target.value) })}
          />
        </label>
      </div>

      <label className="block text-sm">
        Материал стен
        <select
          className="mt-1 w-full rounded border px-3 py-2"
          value={form.wall_material}
          onChange={(e) =>
            setForm({ ...form, wall_material: e.target.value as FoundationInput["wall_material"] })
          }
        >
          <option value="wood">Дерево</option>
          <option value="aerated_concrete">Газобетон</option>
          <option value="brick">Кирпич</option>
          <option value="reinforced_concrete">Железобетон</option>
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          Регион
          <select
            className="mt-1 w-full rounded border px-3 py-2"
            value={form.region}
            onChange={(e) => setForm({ ...form, region: e.target.value })}
          >
            {REGIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Сейсмичность
          <select
            className="mt-1 w-full rounded border px-3 py-2"
            value={form.seismicity}
            onChange={(e) => setForm({ ...form, seismicity: e.target.value })}
          >
            <option value="0-6">0–6 баллов</option>
            <option value="7">7 баллов</option>
            <option value="8+">8+ баллов</option>
          </select>
        </label>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-slate-800 px-4 py-2 text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {loading ? "Расчёт…" : "Подобрать фундамент"}
      </button>
    </form>
  );
}
