import assert from "node:assert/strict";
import test from "node:test";

import { calculateProject as calculateMobileProject } from "../artifacts/grille-calc/lib/calculations.ts";
import { calculateProject as calculateWebProject } from "../artifacts/grille-calc-web/src/lib/calculations.ts";

const sharedInputs = {
  clientName: "",
  wireCostPerMeter: 0,
  labourCostPerSqft: 0,
  channelCostPerPiece: 0,
  fastenerCostPerPiece: 0,
  stiffnerCostMode: "perPiece",
  stiffnerCostPerPiece: 0,
  stiffnerCostPerMeter: 0,
  miscCost: 0,
  connectorCost: 0,
  baseLocation: "",
  siteLocation: "",
  shippingMode: "manual",
  shippingCostManual: 0,
  distanceKm: 0,
  costPerKm: 0,
  sellingPricePerSqft: 0,
  targetProfitPerSqft: 0,
};

const implementations = [
  ["mobile", calculateMobileProject],
  ["web", calculateWebProject],
];

for (const [name, calculateProject] of implementations) {
  test(`${name}: automatic Vertical channel uses top and bottom width across quantity`, () => {
    const opening = {
      id: "vertical-example",
      label: "Vertical example",
      width: 2,
      height: 10,
      quantity: 22,
      modelType: "vertical",
      gapInches: 2,
      channelInputMode: "pcs",
      channelOverride: null,
    };

    const totals = calculateProject([opening], sharedInputs);

    assert.equal(totals.openings[0].totalChannelFeet, 88);
    assert.equal(totals.openings[0].channelPieces, 9);
    assert.equal(totals.totalChannelFeet, 88);
    assert.equal(totals.totalChannelPieces, 9);
  });

  test(`${name}: automatic Vertical pieces round up after combining openings`, () => {
    const openings = [
      {
        id: "vertical-1",
        label: "Vertical 1",
        width: 2,
        height: 10,
        quantity: 1,
        modelType: "vertical",
        gapInches: 2,
        channelInputMode: "pcs",
        channelOverride: null,
      },
      {
        id: "vertical-2",
        label: "Vertical 2",
        width: 3,
        height: 20,
        quantity: 1,
        modelType: "vertical",
        gapInches: 2,
        channelInputMode: "pcs",
        channelOverride: null,
      },
    ];

    const totals = calculateProject(openings, sharedInputs);

    assert.equal(totals.totalChannelFeet, 10);
    assert.equal(totals.totalChannelPieces, 1);
  });

  test(`${name}: automatic Horizontal channel uses left and right height only`, () => {
    const opening = {
      id: "horizontal-example",
      label: "Horizontal example",
      width: 5,
      height: 4.5,
      quantity: 1,
      modelType: "horizontal",
      gapInches: 2,
      channelInputMode: "pcs",
      channelOverride: null,
    };

    const totals = calculateProject(
      [opening],
      { ...sharedInputs, channelCostPerPiece: 1300 },
    );

    assert.equal(totals.openings[0].channelUsedFeet, 9);
    assert.equal(totals.openings[0].channelPieces, 1);
    assert.equal(totals.openings[0].channelBalanceFeet, 1);
    assert.equal(totals.openings[0].channelCost, 1170);
    assert.equal(totals.totalChannelFeet, 9);
    assert.equal(totals.totalChannelPieces, 1);
  });
}
