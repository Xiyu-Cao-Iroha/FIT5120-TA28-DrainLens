library(readr)
library(dplyr)
library(stringr)
library(janitor)

sa1_raw <- read_csv("SA1_2011_AUST.csv", show_col_types = FALSE)

sa1 <- sa1_raw %>%
  clean_names() %>%
  mutate(
    sa1_7digitcode_2011 = as.character(sa1_7digitcode_2011),
    sa2_name_2011 = str_squish(sa2_name_2011),
    sa3_name_2011 = str_squish(sa3_name_2011),
    sa4_name_2011 = str_squish(sa4_name_2011),
    gccsa_name_2011 = str_squish(gccsa_name_2011)
  ) %>%
  filter(!is.na(sa1_7digitcode_2011))

names(sa1)
unique(sa1$state_name_2011)
sa1 <- sa1 %>%
  filter(state_name_2011 == "Victoria")

sa1 <- sa1 %>%
  mutate(
    region_id = as.character(sa1_7digitcode_2011)
  )


sa1_final <- incidents_long %>%
  filter(incident_type == "flood") %>%
  mutate(
    region_id = as.character(region_id),
    count = suppressWarnings(as.numeric(raw_value)),
    suppressed = !is.na(raw_value) & is.na(count)
  ) %>%
  select(
    region_id,
    year,
    count,
    suppressed
  )

sa1_incidents <- sa1 %>%
  left_join(
    sa1_final,
    by = "region_id"
  )


flood_sa4 <- sa1_incidents %>%
  group_by(sa4_name_2011) %>%
  summarise(
    total_flood_incidents = sum(count, na.rm = TRUE),
    .groups = "drop"
  )

sa1_flood <- sa1_incidents %>%
  left_join(
    flood_sa4,
    by = "sa4_name_2011"
  )

sa1_final <- sa1_flood %>%
  select(
    sa1_7digitcode_2011,
    sa2_name_2011,
    sa3_name_2011,
    sa4_name_2011,
    gccsa_name_2011
  )

sa1_final <- sa1_final %>% distinct()
colSums(is.na(sa1_final))

dim(sa1_final)

head(sa1_final)

names(sa1_final)

sum(duplicated(sa1_final))

write_csv(sa1_final, "ABS_victoria.csv")
