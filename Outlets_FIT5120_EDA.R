library(tidyverse)
library(janitor)
library(readxl)
library(scales)
library(geosphere)
library(sf)         
library(leaflet)

# Read datasets
outlets <- read_excel("Melbourne_drain_and_waterway_outlets.xlsx")
centreline <- read_excel("Centreline_of_the_Waterway.xlsx")

head(outlets)

# standardise column names
outlets <- clean_names(outlets)
centreline <- clean_names(centreline)

#verify column names
names(outlets)

outlets <- outlets %>% distinct()

dim(outlets)
## -> no duplicate values

#check missing values
colSums(is.na(outlets))
##-> no missing values

unittype <- unique(outlets$unittype)
print(unittype)

outlets <- outlets %>%
  select(
    -unittype,
    -unittype_desc
  )


#seoarate unit id into asset id and reference to be consistent with waterways centreline dataset
outlets <- outlets %>%
  separate(unitid, into = c("asset_id", "node_ref"), sep = "/", remove = FALSE, extra = "merge")


# municipal code 2 and municipal code 3 mostly contains null values, so retaining municipal code 1 as the reference
centreline <- centreline %>% 
  rename(municipal_code = municipal_code_1)

head(outlets$asset_id)

centreline %>%
  count(asset_id, sort = TRUE) %>%
  filter(n > 1)

# Compare geographic coordinates with projected coordinates
outlets %>%
  select(easting, northing, x, y) %>%
  head()
# view the spatial distribution of locations of outlets on a map
leaflet(outlets) %>%
  addTiles() %>%
  addCircleMarkers(
    lng = ~x, lat = ~y,
    radius = 5, color = "darkred", stroke = FALSE, fillOpacity = 0.7,
    popup = ~paste0("Asset ID: ", asset_id, "<br>Unit ID: ", unitid)
  )


#joining outlets to the waterways centreline dataset
outlets_new <- outlets %>%
  left_join(
    centreline %>%
      select(asset_id, asset_name, material, drainage_category,
             stream_order, municipal_code, length) %>%
      distinct(asset_id, .keep_all = TRUE),
    by = "asset_id"
  )

# check how many records matched with each other
outlets_new %>%
  summarise(
    total_outlets = n(),
    matched = sum(!is.na(asset_name)),
    unmatched = sum(is.na(asset_name)),
    pct_matched = percent(matched / n(), accuracy = 0.1)
  )

#checking for any asset number mismatches
outlets_new %>% filter(is.na(asset_name)) %>% select(unitid, asset_id)

#calculating proportion of outlets that have a recorded match in waterways centreline dataset
outlets_new %>%
  filter(!is.na(material)) %>%
  count(material, sort = TRUE) %>%
  mutate(pct = percent(n / sum(n), accuracy = 0.1))

#summarising drainage category of outlets
outlets_new %>%
  filter(!is.na(drainage_category)) %>%
  count(drainage_category, sort = TRUE)

# view outlets on higher stream-order waterways 
outlets_new %>%
  filter(!is.na(stream_order)) %>%
  count(stream_order) %>%
  ggplot(aes(x = factor(stream_order), y = n)) +
  geom_col(fill = "seagreen") +
  labs(title = "Outlets by stream order of their waterway",
       x = "Stream Order", y = "Number of Outlets") +
  theme_minimal()


#check if each outlet has a corresponding waterway in waterways centreline dataset
outlets_new <- outlets_new %>%
  mutate(
    waterway_connection_status = case_when(
      !is.na(asset_name) ~ "Matched to waterway",
      TRUE ~ "No matching waterway record"
    )
  )

outlets_new %>%
  count(waterway_connection_status) %>%
  mutate(
    pct = percent(n / sum(n), accuracy = 0.1)
  )


# Outlet density by municipality 
outlets_new %>%
  filter(!is.na(municipal_code)) %>%
  count(municipal_code, sort = TRUE) %>%
  slice_head(n = 15) %>%
  ggplot(aes(x = reorder(municipal_code, n), y = n)) +
  geom_col(fill = "royalblue") +
  coord_flip() +
  labs(title = "Number of Outlets by Municipality ",
       x = "Municipal Code", y = "Number of Outlets") +
  theme_minimal()
outlets_on_priority %>% select(unitid, asset_name, material, stream_order, municipal_code)


write_csv(outlets, "Outlets_Cleaned.csv")
