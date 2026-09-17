#load required libraries
library(tidyverse)
library(janitor)
library(dplyr)
library(scales)


# Read dataset
incidents_raw <- read_excel("VICSES Incidents.xlsx", col_names = FALSE)
                        

incidents <- incidents_raw %>%
  slice(5:n()) %>%
  set_names(combined_names) %>%
  filter(!is.na(region_id))

incidents_long <- incidents %>%
  pivot_longer(
    cols = -region_id,
    names_to = "col",
    values_to = "raw_value"
  ) %>%
  separate(
    col,
    into = c("incident_type", "year"),
    sep = "_(?=[0-9]{4}_[0-9]{2}$)",   
    extra = "merge"

    )
incidents_long %>% count(incident_type, sort = TRUE)
incidents_long %>% count(year, sort = TRUE)

incidents_flood <- incidents_long %>%
  filter(incident_type == "flood")

incidents_flood <- incidents_flood %>%
  mutate(
    count = suppressWarnings(as.numeric(raw_value)),
    suppressed = !is.na(raw_value) & is.na(count)
  ) %>%
  select(region_id, incident_type, year, count, suppressed)

incidents_flood %>% count(suppressed)
incidents_flood %>% count(year)

head(incidents_flood)
dim(incidents_flood)

incidents_flood <- incidents_flood %>% distinct()
colSums(is.na(incidents_flood))


head(incidents_flood)

write_csv(incidents_long, "VICSES_Incidents_Long.csv")
