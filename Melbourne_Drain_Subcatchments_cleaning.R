library(readr)
library(tidyverse)
library(janitor)
library(dplyr)
library(readxl)
library(scales)
library(lubridate)
library(sf)

catch <- read_csv("MelbourneWater_Drains_Subcatchments.csv")
dim(catch)

dim(catch)

#cleaning column names
head(catch)
catch <- clean_names(catch)
names(catch)

#verifying there is no duplicates
catch <- catch %>% distinct()
dim(catch)

catch %>% count(objectid) %>% filter(n > 1)
catch %>% count(sub_catchment_nbr) %>% filter(n > 1)

colSums(is.na(catch))


catch <- catch %>%
  mutate(
    date_captured = mdy_hms(date_captured),
    date_last_updated = mdy_hms(date_last_updated),
    record_last_updated_year = year(date_last_updated)
  )

#removing last updated date column 
catch <- catch %>% select(-date_last_updated)


catch %>%
  filter(str_detect(sub_catchment_name, "^\\s*[0-9]")) %>%
  pull(sub_catchment_name)

#expanding abbreviations to plain english
abbreviation_map_draft <- c(
  "\\bTRIB\\b" = "Tributary",
  "\\bD\\.S\\.?\\b" = "Downstream",
  "\\bU/S\\b" = "Upstream",
  "\\bD/S\\b" = "Downstream",
  "\\bM\\.D\\.?\\b" = "Main Drain"
)

catch <- catch %>%
  mutate(
    display_name_draft = sub_catchment_name %>%
      str_remove("^\\s*[0-9]+\\s*") %>%
      str_replace_all(abbreviation_map_draft) %>%
      str_to_title() %>%
      str_squish()
  )

catch %>%
  select(sub_catchment_name, display_name_draft) %>%
  filter(str_detect(sub_catchment_name, "TRIB|D\\.S\\.|M\\.D\\.|U/S|D/S")) %>%
  distinct() %>%
  head(15)


catch <- catch %>%
  mutate(
    receiving_drain_classification_draft = case_when(
      str_detect(sub_catchment_name, regex("COUNCIL DRAINAGE", ignore_case = TRUE)) ~
        "Council drainage discharging directly",
      str_detect(sub_catchment_name, regex("M\\.D\\.?\\b", ignore_case = TRUE)) ~
        "Melbourne Water main drain",
      !is.na(primary_catchment_name) | !is.na(river_basin_catchment_name) ~
        "Waterway section",
      TRUE ~ "Unclassified - pending approved register"
    )
  )

catch %>% count(receiving_drain_classification_draft, sort = TRUE) %>%
  mutate(pct = percent(n / sum(n), accuracy = 0.1))

#validating recorded area
summary(catch$area_sq_km)
catch %>% filter(area_sq_km <= 0)
catch %>% filter(area_sq_km > quantile(area_sq_km, 0.995)) %>%
  select(sub_catchment_nbr, display_name_draft, area_sq_km) %>%
  arrange(desc(area_sq_km))

write_csv(catch, "MelbourneWater_Drains_Subcatchments_Cleaned.csv" )