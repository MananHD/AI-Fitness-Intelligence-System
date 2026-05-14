"""
diet_planner.py – Personalised meal plan generator.

Input : BMI category, sport, dietary preference, weight (kg)
Output: Structured meal plan with breakfast/lunch/dinner/snacks + calorie targets.
"""

from __future__ import annotations

import csv
import logging
from dataclasses import dataclass, asdict
from functools import lru_cache
from pathlib import Path
from typing import Literal

logger = logging.getLogger(__name__)

DietaryPreference = Literal["veg", "non-veg", "vegan"]
DATASET_PATH = Path(__file__).resolve().parents[1] / "data_sports" / "food_details" / "InDiet_Dataset.csv"
NON_VEG_WORDS = {
    "meat", "chicken", "fish", "egg", "mutton", "beef", "prawn", "shrimp",
    "seafood", "shellfish", "lobster", "tuna", "salmon",
}
DAIRY_WORDS = {
    "milk", "dairy", "paneer", "curd", "yoghurt", "yogurt", "cheese",
    "butter", "ghee", "lassi", "cream", "buttermilk", "whey",
}


@dataclass
class Meal:
    name: str
    items: list[str]
    approx_calories: int
    portion_g: int = 100

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
    bmr: int
    sport_category: str
    activity_multiplier: float
    protein_target_g: int
    carbs_target_g: int
    fats_target_g: int
    water_litres: float
    notes: list[str]

    def to_dict(self) -> dict:
        return asdict(self)


def _normalise_sport(sport: str) -> str:
    return str(sport or "").lower().replace("-", "_").replace(" ", "_")


def _sport_category(sport: str) -> str:
    sport_key = _normalise_sport(sport)
    precision = {"archery", "shooting"}
    power = {"kabaddi", "wrestling", "basketball", "badminton", "volleyball", "weightlifting"}
    endurance = {"football", "athletics", "athletics_(track)", "field_hockey", "running"}
    if sport_key in precision:
        return "Precision"
    if sport_key in power:
        return "Power/Agility"
    if sport_key in endurance:
        return "Endurance"
    return "Mixed"


def _activity_multiplier(category: str) -> float:
    return {
        "Precision": 1.4,
        "Mixed": 1.6,
        "Power/Agility": 1.7,
        "Endurance": 1.9,
    }.get(category, 1.6)


def _bmr_mifflin_st_jeor(weight_kg: float, height_cm: float, age: int, gender: str) -> int:
    offset = -161 if str(gender or "").lower().startswith("f") else 5
    return int((10 * weight_kg) + (6.25 * height_cm) - (5 * age) + offset)


def _goal_adjustment(bmi_category: str) -> float:
    return {
        "Underweight": 1.08,
        "Normal": 1.0,
        "Overweight": 0.92,
        "Obese": 0.85,
    }.get(bmi_category, 1.0)


def _calorie_target(
    bmi_category: str,
    sport: str,
    weight_kg: float,
    height_cm: float,
    age: int,
    gender: str,
) -> tuple[int, int, str, float]:
    bmr = _bmr_mifflin_st_jeor(weight_kg, height_cm, age, gender)
    category = _sport_category(sport)
    multiplier = _activity_multiplier(category)
    target = int(bmr * multiplier * _goal_adjustment(bmi_category))
    return max(1200, min(target, 4800)), bmr, category, multiplier


def _macro_targets(total_calories: int, weight_kg: float, category: str) -> tuple[int, int, int]:
    if category == "Power/Agility":
        protein_g = int(weight_kg * 2.0)
        fat_calories = total_calories * 0.25
    elif category == "Endurance":
        protein_g = int(weight_kg * 1.6)
        fat_calories = total_calories * 0.22
    elif category == "Precision":
        protein_g = int(weight_kg * 1.5)
        fat_calories = total_calories * 0.28
    else:
        protein_g = int(weight_kg * 1.7)
        fat_calories = total_calories * 0.25

    fats_g = int(fat_calories / 9)
    remaining = max(total_calories - (protein_g * 4) - (fats_g * 9), 0)
    carbs_g = int(remaining / 4)
    return protein_g, carbs_g, fats_g


def _scale_meal_calories(template: dict, target_calories: int) -> dict:
    meal_weights = {
        "breakfast": 0.25,
        "mid_morning_snack": 0.10,
        "lunch": 0.30,
        "evening_snack": 0.10,
        "dinner": 0.25,
    }
    scaled = {}
    for key, meal in template.items():
        scaled[key] = {**meal, "approx_calories": int(target_calories * meal_weights[key])}
    return scaled


def _to_float(value, default=0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


@lru_cache(maxsize=1)
def _load_food_dataset() -> tuple[dict, ...]:
    if not DATASET_PATH.exists():
        return tuple()

    foods = []
    with DATASET_PATH.open("r", encoding="utf-8-sig", newline="") as fh:
        for row in csv.DictReader(fh):
            row["energy_kcal"] = _to_float(row.get("energy_kcal"))
            row["protein_g"] = _to_float(row.get("protein_g"))
            row["carb_g"] = _to_float(row.get("carb_g"))
            row["fat_g"] = _to_float(row.get("fat_g"))
            row["fibre_g"] = _to_float(row.get("fibre_g"))
            row["freesugar_g"] = _to_float(row.get("freesugar_g"))
            row["cholesterol_mg"] = _to_float(row.get("cholesterol_mg"))
            row["health_score"] = _to_float(row.get("health_score"))
            row["nutrient_score"] = _to_float(row.get("nutrient_score"))
            row["diversity_score"] = _to_float(row.get("diversity_score"))
            foods.append(row)
    return tuple(foods)


def _contains_any(text: str, words: set[str]) -> bool:
    haystack = str(text or "").lower()
    return any(word in haystack for word in words)


def _is_non_veg(food: dict) -> bool:
    group = str(food.get("food_group_nin") or "").lower()
    text = f"{food.get('food_name', '')} {food.get('allergies', '')}"
    return "non-vegetarian" in group or _contains_any(text, NON_VEG_WORDS)


def _is_vegan_safe(food: dict) -> bool:
    text = f"{food.get('food_name', '')} {food.get('allergies', '')}"
    return not _is_non_veg(food) and not _contains_any(text, DAIRY_WORDS)


def _allowed_for_preference(food: dict, pref: str) -> bool:
    if pref == "non-veg":
        return True
    if pref == "vegan":
        return _is_vegan_safe(food)
    return not _is_non_veg(food)


def _slot_food_types(slot: str) -> set[str]:
    return {
        "breakfast": {"breakfast"},
        "mid_morning_snack": {"snacks", "side dish", "dessert", "soup"},
        "lunch": {"lunch"},
        "evening_snack": {"snacks", "side dish", "soup", "dessert"},
        "dinner": {"dinner", "soup"},
    }[slot]


def _sport_score(food: dict, sport_category: str) -> float:
    calories = max(food["energy_kcal"], 1)
    protein_ratio = food["protein_g"] / calories
    carb_ratio = food["carb_g"] / calories
    fat_ratio = food["fat_g"] / calories
    sugar_ratio = food["freesugar_g"] / calories

    if sport_category == "Power/Agility":
        return protein_ratio * 260 + food["health_score"] * 0.35
    if sport_category == "Endurance":
        return carb_ratio * 120 + food["fibre_g"] * 1.5 + food["health_score"] * 0.25
    if sport_category == "Precision":
        return food["health_score"] * 0.45 - sugar_ratio * 140 - fat_ratio * 35
    return food["health_score"] * 0.35 + food["nutrient_score"] * 8


def _preference_score(food: dict, pref: str, slot: str) -> float:
    if pref == "non-veg" and slot in {"lunch", "dinner"} and _is_non_veg(food):
        return 22
    if pref == "vegan" and str(food.get("food_group_nin") or "").lower() == "vegan":
        return 10
    return 0


def _pick_dataset_meal(
    slot: str,
    target_calories: int,
    target_protein_g: int,
    target_carbs_g: int,
    target_fats_g: int,
    pref: str,
    sport_category: str,
    day_index: int,
    excluded_names: set[str] | None = None,
) -> Meal | None:
    foods = [
        food for food in _load_food_dataset()
        if food["energy_kcal"] > 0
        and str(food.get("food_type") or "").lower() in _slot_food_types(slot)
        and _allowed_for_preference(food, pref)
    ]
    non_veg_foods = [food for food in foods if _is_non_veg(food)]
    if pref == "non-veg" and slot in {"lunch", "dinner"} and non_veg_foods:
        foods = non_veg_foods
    if not foods:
        return None

    scored = []
    for food in foods:
        scale = max(0.65, min(target_calories / max(food["energy_kcal"], 1), 2.4))
        protein = food["protein_g"] * scale
        carbs = food["carb_g"] * scale
        fats = food["fat_g"] * scale
        macro_gap = (
            abs(protein - target_protein_g) * 5
            + abs(carbs - target_carbs_g) * 1.6
            + abs(fats - target_fats_g) * 3
        )
        calorie_gap = abs((food["energy_kcal"] * scale) - target_calories) * 0.08
        score = (
            _sport_score(food, sport_category)
            + _preference_score(food, pref, slot)
            + food["diversity_score"] * 2
            - macro_gap
            - calorie_gap
        )
        scored.append((score, food, scale))

    scored.sort(key=lambda item: item[0], reverse=True)
    excluded = excluded_names or set()
    pick = None
    if scored:
        for offset in range(len(scored)):
            candidate = scored[(day_index + offset) % len(scored)]
            if candidate[1].get('food_name') not in excluded:
                pick = candidate
                break
        if pick is None:
            pick = scored[day_index % min(len(scored), 12)]
    food = pick[1]
    scale = pick[2]
    portion_g = int(max(_to_float(food.get("Serving_Size_g"), 100) * scale, 40))
    calories = int(food["energy_kcal"] * scale)
    name = str(food.get("food_name") or "Meal")
    return Meal(
        name=name,
        items=[
            f"Eat about {portion_g} g of {name}",
            f"Protein {int(food['protein_g'] * scale)}g, carbs {int(food['carb_g'] * scale)}g, fats {int(food['fat_g'] * scale)}g",
            f"{food.get('region') or 'Pan-India'} · {food.get('food_group_nin') or 'Food'}",
        ],
        approx_calories=calories,
        portion_g=portion_g,
    )


def _dataset_meals(
    pref: str,
    sport_category: str,
    total_calories: int,
    protein_g: int,
    carbs_g: int,
    fats_g: int,
    day_index: int,
) -> dict[str, Meal] | None:
    meal_weights = {
        "breakfast": 0.25,
        "mid_morning_snack": 0.10,
        "lunch": 0.30,
        "evening_snack": 0.10,
        "dinner": 0.25,
    }
    meals = {}
    used_names: set[str] = set()
    for offset, (slot, weight) in enumerate(meal_weights.items()):
        meal = _pick_dataset_meal(
            slot,
            int(total_calories * weight),
            int(protein_g * weight),
            int(carbs_g * weight),
            int(fats_g * weight),
            pref,
            sport_category,
            day_index * 5 + offset,
            excluded_names=used_names,
        )
        if meal is None:
            return None
        meals[slot] = meal
        used_names.add(meal.name)
    return meals


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
        height_cm: float = 170,
        age: int = 25,
        gender: str = "male",
        day_index: int = 0,
    ) -> DailyMealPlan:
        pref = dietary_preference.lower()
        key = (bmi_category, pref)
        template = _TEMPLATES.get(key) or _TEMPLATES.get((bmi_category, "veg"))

        if not template:
            raise ValueError(f"No diet template for {bmi_category}.")

        total_calories, bmr, category, multiplier = _calorie_target(
            bmi_category,
            sport,
            weight_kg,
            height_cm,
            age,
            gender,
        )
        protein_g, carbs_g, fats_g = _macro_targets(total_calories, weight_kg, category)
        scaled_template = _scale_meal_calories(template, total_calories)
        dataset_meals = _dataset_meals(
            pref,
            category,
            total_calories,
            protein_g,
            carbs_g,
            fats_g,
            day_index,
        )

        return DailyMealPlan(
            breakfast=dataset_meals["breakfast"] if dataset_meals else Meal(**scaled_template["breakfast"]),
            mid_morning_snack=dataset_meals["mid_morning_snack"] if dataset_meals else Meal(**scaled_template["mid_morning_snack"]),
            lunch=dataset_meals["lunch"] if dataset_meals else Meal(**scaled_template["lunch"]),
            evening_snack=dataset_meals["evening_snack"] if dataset_meals else Meal(**scaled_template["evening_snack"]),
            dinner=dataset_meals["dinner"] if dataset_meals else Meal(**scaled_template["dinner"]),
            total_calories=total_calories,
            bmr=bmr,
            sport_category=category,
            activity_multiplier=multiplier,
            protein_target_g=protein_g,
            carbs_target_g=carbs_g,
            fats_target_g=fats_g,
            water_litres=round(weight_kg * 0.033, 1),
            notes=self._notes(bmi_category, sport, category, multiplier, pref, weight_kg),
        )

    def plan_as_dict(
        self,
        bmi_category,
        sport,
        sport_intensity,
        dietary_preference,
        weight_kg,
        height_cm=170,
        age=25,
        gender="male",
        day_index=0,
    ) -> dict:
        return self.plan(
            bmi_category,
            sport,
            sport_intensity,
            dietary_preference,
            weight_kg,
            height_cm,
            age,
            gender,
            day_index,
        ).to_dict()

    @staticmethod
    def _notes(bmi_category, sport, sport_category, multiplier, pref, weight_kg) -> list[str]:
        notes = [
            f"Calories use Mifflin-St Jeor BMR with a {multiplier}x {sport_category} sport multiplier.",
            f"Tailored for {bmi_category} individual practising {sport}.",
            f"Drink at least {round(weight_kg * 0.033, 1)} L of water daily.",
            "Avoid processed foods, refined sugars, and trans fats.",
            "Eat dinner at least 2 hours before bedtime.",
        ]
        if bmi_category == "Obese":
            notes.append("Consult a registered dietitian before major dietary changes.")
        if sport_category in {"Power/Agility", "Endurance"}:
            notes.append("Have a post-workout meal within 30 min of exercise.")
        if pref == "vegan":
            notes.append("Supplement with B12, Vitamin D, and Omega-3 (algae-based).")
        return notes
