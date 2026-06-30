"use client";

import { Input, Select } from "./input";
import {
  CA_PROVINCES,
  regionFieldLabel,
  SIGNUP_COUNTRIES,
  US_STATES,
  type SignupCountryCode,
} from "@/lib/geo/signup-locations";

export type SignupLocationValue = {
  country: SignupCountryCode;
  otherCountry: string;
  region: string;
  city: string;
};

export function SignupLocationFields({
  value,
  onChange,
}: {
  value: SignupLocationValue;
  onChange: (v: SignupLocationValue) => void;
}) {
  const regionLabel = regionFieldLabel(value.country);
  const useRegionSelect = value.country === "CA" || value.country === "US";
  const regionOptions = value.country === "CA" ? CA_PROVINCES : US_STATES;

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-forward-700">Country</label>
        <Select
          value={value.country}
          onChange={(e) =>
            onChange({
              ...value,
              country: e.target.value as SignupCountryCode,
              region: "",
            })
          }
        >
          {SIGNUP_COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </Select>
      </div>

      {value.country === "OTHER" && (
        <div>
          <label className="mb-1 block text-sm font-medium text-forward-700">Country name</label>
          <Input
            value={value.otherCountry}
            onChange={(e) => onChange({ ...value, otherCountry: e.target.value })}
            placeholder="Your country"
            required
          />
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-forward-700">{regionLabel}</label>
        {useRegionSelect ? (
          <Select
            value={value.region}
            onChange={(e) => onChange({ ...value, region: e.target.value })}
            required
          >
            <option value="">Select {regionLabel.toLowerCase()}</option>
            {regionOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            value={value.region}
            onChange={(e) => onChange({ ...value, region: e.target.value })}
            placeholder={regionLabel}
            required
          />
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-forward-700">City</label>
        <Input
          value={value.city}
          onChange={(e) => onChange({ ...value, city: e.target.value })}
          placeholder="Your city"
          required
        />
      </div>
    </div>
  );
}
