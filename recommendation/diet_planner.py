"""
diet_planner.py – Personalised meal plan generator.

Input : BMI category, sport, dietary preference, weight (kg)
Output: Structured meal plan with breakfast/lunch/dinner/snacks + calorie targets.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, asdict
from typing import Literal

logger = logging.getLogger(__name__)

DietaryPreference = Literal["veg", "non-veg", "vegan"]


@dataclass
class Meal:
    name: str
    items: list[str]
    approx_calories: int

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class DailyMealPlan:
    breakfast: Meal
    mid_morning_snack: Meal
    lunch: Meal
    evening_snack: Meal
    dinner: Meal
    total_calories: int
    protein_target_g: int
    water_litres: float
    notes: list[str]

    def to_dict(self) -> dict:
        return asdict(self)


def _calorie_target(bmi_category: str, sport_intensity: str, weight_kg: float) -> int:
    base_factors = {"Underweight": 35, "Normal": 30, "Overweight": 25, "Obese": 22}
    activity_mult = {"Low": 1.3, "Moderate": 1.55, "High": 1.75}
    base = weight_kg * base_factors.get(bmi_category, 28)
    mult = activity_mult.get(sport_intensity, 1.4)
    return max(1200, min(int(base * mult), 4500))


def _protein_target(weight_kg: float, bmi_category: str) -> int:
    factors = {"Underweight": 1.8, "Normal": 1.5, "Overweight": 1.4, "Obese": 1.2}
    return int(weight_kg * factors.get(bmi_category, 1.5))


# ─── Meal Templates ────────────────────────────────────────────────────────────
_TEMPLATES: dict[tuple[str, str], dict] = {
    ("Underweight", "veg"): {
        "breakfast":         {"name": "High-Calorie Veg Breakfast",   "items": ["Peanut butter banana smoothie", "2 parathas with ghee", "Full-fat yoghurt"],               "approx_calories": 650},
        "mid_morning_snack": {"name": "Calorie Boost",                "items": ["Mixed nuts", "1 banana", "1 glass whole milk"],                                            "approx_calories": 300},
        "lunch":             {"name": "Protein-Rich Lunch",           "items": ["2 cups rajma", "1.5 cups brown rice", "Mixed sabzi", "1 glass lassi"],                     "approx_calories": 800},
        "evening_snack":     {"name": "Energy Snack",                 "items": ["Avocado toast", "1 cheese slice"],                                                         "approx_calories": 300},
        "dinner":            {"name": "Balanced Veg Dinner",          "items": ["Paneer tikka masala", "2 chapatis", "Dal makhani", "Salad"],                               "approx_calories": 700},
    },
    ("Underweight", "non-veg"): {
        "breakfast":         {"name": "Protein-Rich Breakfast",       "items": ["3 scrambled eggs", "2 whole-wheat toast", "1 glass whole milk", "1 banana"],              "approx_calories": 700},
        "mid_morning_snack": {"name": "Calorie Boost",                "items": ["Mixed nuts", "Protein shake"],                                                             "approx_calories": 350},
        "lunch":             {"name": "High-Protein Lunch",           "items": ["200 g grilled chicken", "1.5 cups rice", "Mixed vegetables", "1 glass milk"],             "approx_calories": 850},
        "evening_snack":     {"name": "Recovery Snack",               "items": ["Greek yoghurt", "1 banana", "Almonds"],                                                   "approx_calories": 280},
        "dinner":            {"name": "Balanced Dinner",              "items": ["Fish curry (150 g)", "2 chapatis", "Dal", "Vegetable stir-fry"],                          "approx_calories": 720},
    },
    ("Underweight", "vegan"): {
        "breakfast":         {"name": "High-Calorie Vegan Breakfast", "items": ["Oat smoothie with almond butter + banana", "2 whole-grain toast", "Avocado"],             "approx_calories": 650},
        "mid_morning_snack": {"name": "Energy Snack",                 "items": ["Trail mix (nuts + dried fruit)", "1 glass oat milk"],                                     "approx_calories": 310},
        "lunch":             {"name": "Calorie-Dense Lunch",          "items": ["Chickpea curry", "1.5 cups brown rice", "Steamed broccoli", "Tahini dressing"],           "approx_calories": 780},
        "evening_snack":     {"name": "Nut Butter Snack",             "items": ["Rice cakes with almond butter", "1 banana"],                                              "approx_calories": 280},
        "dinner":            {"name": "Protein-Rich Vegan Dinner",    "items": ["Lentil soup (2 bowls)", "Quinoa salad", "Roasted sweet potato"],                         "approx_calories": 700},
    },
    ("Normal", "veg"): {
        "breakfast":         {"name": "Balanced Veg Breakfast",       "items": ["Oatmeal with berries + flaxseeds", "1 glass low-fat milk", "Green tea"],                  "approx_calories": 450},
        "mid_morning_snack": {"name": "Light Snack",                  "items": ["1 apple", "10 almonds"],                                                                  "approx_calories": 180},
        "lunch":             {"name": "Balanced Veg Lunch",           "items": ["1 cup dal", "1 cup brown rice", "Sabzi", "Raita", "Salad"],                              "approx_calories": 600},
        "evening_snack":     {"name": "Pre-Workout Snack",            "items": ["Banana", "Handful of walnuts"],                                                           "approx_calories": 200},
        "dinner":            {"name": "Light Veg Dinner",             "items": ["Grilled paneer (100 g)", "2 chapatis", "Stir-fried veg", "Tomato soup"],                 "approx_calories": 550},
    },
    ("Normal", "non-veg"): {
        "breakfast":         {"name": "Protein Breakfast",            "items": ["2 scrambled eggs", "1 slice whole-grain toast", "1 banana", "Green tea"],                "approx_calories": 480},
        "mid_morning_snack": {"name": "Light Snack",                  "items": ["Low-fat Greek yoghurt", "5 almonds"],                                                     "approx_calories": 150},
        "lunch":             {"name": "Balanced Lunch",               "items": ["150 g grilled chicken", "1 cup brown rice", "Mixed salad"],                              "approx_calories": 620},
        "evening_snack":     {"name": "Recovery Snack",               "items": ["1 banana", "Peanut butter (1 tbsp)"],                                                    "approx_calories": 200},
        "dinner":            {"name": "Light Dinner",                 "items": ["Baked fish (120 g)", "Steamed veg", "1 chapati", "Greens salad"],                        "approx_calories": 520},
    },
    ("Normal", "vegan"): {
        "breakfast":         {"name": "Vegan Performance Breakfast",  "items": ["Overnight oats + chia + berries", "Almond milk", "Green tea"],                            "approx_calories": 420},
        "mid_morning_snack": {"name": "Fruit Snack",                  "items": ["1 orange", "10 cashews"],                                                                 "approx_calories": 170},
        "lunch":             {"name": "Balanced Vegan Lunch",         "items": ["Tofu stir-fry", "Brown rice", "Steamed broccoli", "Tahini dressing"],                    "approx_calories": 600},
        "evening_snack":     {"name": "Energy Snack",                 "items": ["Hummus + veggie sticks"],                                                                 "approx_calories": 180},
        "dinner":            {"name": "Light Vegan Dinner",           "items": ["Lentil soup", "1 slice whole-grain bread", "Mixed salad"],                               "approx_calories": 480},
    },
    ("Overweight", "veg"): {
        "breakfast":         {"name": "Low-Cal Veg Breakfast",        "items": ["Tofu scramble / veg omelette (no oil)", "1 whole-grain toast", "Green tea"],              "approx_calories": 320},
        "mid_morning_snack": {"name": "Metabolism Booster",           "items": ["1 apple or pear", "Green tea"],                                                           "approx_calories": 100},
        "lunch":             {"name": "Calorie-Controlled Lunch",     "items": ["1 cup dal", "2 chapatis (no ghee)", "Large salad", "Buttermilk"],                        "approx_calories": 480},
        "evening_snack":     {"name": "Low-Cal Snack",                "items": ["Cucumber + carrot sticks", "Hummus (2 tbsp)"],                                           "approx_calories": 120},
        "dinner":            {"name": "Light Dinner",                 "items": ["Grilled veg", "1 cup lentil soup", "1 chapati"],                                         "approx_calories": 400},
    },
    ("Overweight", "non-veg"): {
        "breakfast":         {"name": "High-Protein Low-Cal",         "items": ["2 boiled egg whites", "1 whole-grain toast", "Green tea"],                               "approx_calories": 280},
        "mid_morning_snack": {"name": "Appetite Controller",          "items": ["1 apple", "5 almonds"],                                                                   "approx_calories": 120},
        "lunch":             {"name": "Lean Protein Lunch",           "items": ["120 g grilled chicken (no skin)", "Large green salad", "1 chapati"],                     "approx_calories": 480},
        "evening_snack":     {"name": "Light Snack",                  "items": ["Low-fat plain yoghurt"],                                                                  "approx_calories": 100},
        "dinner":            {"name": "Lean Dinner",                  "items": ["Steamed fish (100 g)", "Stir-fried veg (no oil)", "1 chapati"],                          "approx_calories": 380},
    },
    ("Overweight", "vegan"): {
        "breakfast":         {"name": "Fibre-Rich Vegan Breakfast",   "items": ["Oatmeal with chia seeds (water, no sugar)", "Green tea"],                                 "approx_calories": 300},
        "mid_morning_snack": {"name": "Detox Snack",                  "items": ["Celery + cucumber sticks", "Lemon water"],                                               "approx_calories": 50},
        "lunch":             {"name": "Plant-Based Lean Lunch",       "items": ["Chickpea salad bowl", "Quinoa (1/2 cup)", "Lemon-herb dressing"],                        "approx_calories": 460},
        "evening_snack":     {"name": "Gut-Health Snack",             "items": ["1 pear", "5 walnuts"],                                                                   "approx_calories": 130},
        "dinner":            {"name": "Light Vegan Dinner",           "items": ["Vegetable clear soup", "Lentil patties (2)", "Green salad"],                            "approx_calories": 380},
    },
    ("Obese", "veg"): {
        "breakfast":         {"name": "Calorie-Deficit Breakfast",    "items": ["Vegetable upma (1 cup, no oil)", "1 glass buttermilk", "Green tea"],                     "approx_calories": 260},
        "mid_morning_snack": {"name": "Hydration Snack",              "items": ["1 cucumber", "Lemon water"],                                                              "approx_calories": 40},
        "lunch":             {"name": "High-Fibre Lunch",             "items": ["Moong dal soup (2 cups)", "Large salad", "1 small chapati"],                             "approx_calories": 380},
        "evening_snack":     {"name": "Craving Control",              "items": ["Roasted makhana (30 g)", "Green tea"],                                                   "approx_calories": 110},
        "dinner":            {"name": "Ultra-Light Dinner",           "items": ["Vegetable soup", "Steamed sprouts salad"],                                               "approx_calories": 280},
    },
    ("Obese", "non-veg"): {
        "breakfast":         {"name": "Lean Protein Start",           "items": ["2 boiled egg whites", "Green tea (no sugar)", "1/2 banana"],                            "approx_calories": 200},
        "mid_morning_snack": {"name": "Hydration Break",              "items": ["Cucumber slices", "Lemon water"],                                                        "approx_calories": 30},
        "lunch":             {"name": "Protein + Veg Lunch",          "items": ["100 g poached chicken", "Large salad (no dressing)", "Clear broth soup"],               "approx_calories": 360},
        "evening_snack":     {"name": "Low-Cal Snack",                "items": ["Low-fat plain yoghurt (100 g)"],                                                         "approx_calories": 80},
        "dinner":            {"name": "Ultra-Light Dinner",           "items": ["Steamed fish (80 g)", "Steamed vegetables"],                                             "approx_calories": 280},
    },
    ("Obese", "vegan"): {
        "breakfast":         {"name": "Detox Vegan Breakfast",        "items": ["Overnight oats (water, no sugar)", "Green tea"],                                         "approx_calories": 250},
        "mid_morning_snack": {"name": "Alkaline Snack",               "items": ["Cucumber water"],                                                                         "approx_calories": 20},
        "lunch":             {"name": "Fibre-Max Lunch",              "items": ["Lentil + vegetable soup (2 bowls)", "Side salad"],                                       "approx_calories": 360},
        "evening_snack":     {"name": "Gut-Friendly Snack",           "items": ["5 almonds", "Herbal tea"],                                                               "approx_calories": 70},
        "dinner":            {"name": "Minimal Calorie Dinner",       "items": ["Steamed broccoli + spinach", "Lentil soup (1 cup)"],                                    "approx_calories": 250},
    },
}


class DietPlanner:
    """
    Generates a structured daily meal plan.

    Usage:
        planner = DietPlanner()
        plan = planner.plan("Overweight", "Swimming", "Moderate", "veg", 80)
        print(plan.to_dict())
    """

    def plan(
        self,
        bmi_category: str,
        sport: str,
        sport_intensity: str,
        dietary_preference: DietaryPreference,
        weight_kg: float,
    ) -> DailyMealPlan:
        pref = dietary_preference.lower()
        key = (bmi_category, pref)
        template = _TEMPLATES.get(key) or _TEMPLATES.get((bmi_category, "veg"))

        if not template:
            raise ValueError(f"No diet template for {bmi_category}.")

        return DailyMealPlan(
            breakfast=Meal(**template["breakfast"]),
            mid_morning_snack=Meal(**template["mid_morning_snack"]),
            lunch=Meal(**template["lunch"]),
            evening_snack=Meal(**template["evening_snack"]),
            dinner=Meal(**template["dinner"]),
            total_calories=_calorie_target(bmi_category, sport_intensity, weight_kg),
            protein_target_g=_protein_target(weight_kg, bmi_category),
            water_litres=round(weight_kg * 0.033, 1),
            notes=self._notes(bmi_category, sport, sport_intensity, pref, weight_kg),
        )

    def plan_as_dict(self, bmi_category, sport, sport_intensity, dietary_preference, weight_kg) -> dict:
        return self.plan(bmi_category, sport, sport_intensity, dietary_preference, weight_kg).to_dict()

    @staticmethod
    def _notes(bmi_category, sport, sport_intensity, pref, weight_kg) -> list[str]:
        notes = [
            f"Tailored for {bmi_category} individual practising {sport} ({sport_intensity} intensity).",
            f"Drink at least {round(weight_kg * 0.033, 1)} L of water daily.",
            "Avoid processed foods, refined sugars, and trans fats.",
            "Eat dinner at least 2 hours before bedtime.",
        ]
        if bmi_category == "Obese":
            notes.append("Consult a registered dietitian before major dietary changes.")
        if sport_intensity == "High":
            notes.append("Have a post-workout meal within 30 min of exercise.")
        if pref == "vegan":
            notes.append("Supplement with B12, Vitamin D, and Omega-3 (algae-based).")
        return notes
