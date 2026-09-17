
#load required libraries
library(tidyverse)
library(janitor)
library(scales)
library(leaflet)
library(viridis)

# Read datasets
stormwater <- read_csv("Stormwater_Pits.csv")
drainpipe <- read_csv("Drainpipes.csv") %>% clean_names()

head(stormwater)
stormwater <- clean_names(stormwater)

#verify column names
names(stormwater)

#check missing values
colSums(is.na(stormwater))

#remove column location since columns latitude and longitude are present
stormwater <- stormwater %>%
  select(
    -location
  )


#check for any duplicate assets
dup_assets <- stormwater %>%
  count(asset_number) %>%
  filter(n > 1)

n_dup_assets <- nrow(dup_assets)
print(n_dup_assets)

#view and sort categories and types of construction and grate materials and other objects
stormwater %>% count(construction_material_lupvalue, sort = TRUE)
stormwater %>% count(grate_material_lupvalue, sort = TRUE)
stormwater %>% count(object_type_lupvalue, sort = TRUE)
stormwater %>% count(overflow_kerb_lupvalue, sort = TRUE)

# Trimming whitespaces and normalising case of categories 
cols <- c("construction_material_lupvalue", "grate_material_lupvalue",
                 "model_descr_lupvalue", "object_type_lupvalue",
                 "overflow_kerb_lupvalue", "asset_description")

stormwater <- stormwater %>%
  mutate(across(all_of(cols), ~ str_squish(.)))

# Keep "Not Known" values separate from NA
stormwater %>%
  summarise(
    material_not_known  = sum(construction_material_lupvalue == "Not Known", na.rm = TRUE),
    material_na  = sum(is.na(construction_material_lupvalue))
  )



# Checking consistency between the pit description, grate material, and grate dimensions to 
# identify whether grate-related information is recorded consistently in the dataset
stormwater %>%
  mutate(
    has_grate_desc = str_detect(
      asset_description,
      regex("Grated|Trench Grate", ignore_case = TRUE)
    ),
    has_grate_material = !is.na(grate_material_lupvalue) &
      !grate_material_lupvalue %in% c("None", "Not Known"),
    has_grate_dimensions = !is.na(grate_length) | !is.na(grate_width)
  ) %>%
  count(has_grate_desc, has_grate_material, has_grate_dimensions)




# Grouping all subcategories of construction material into a common name
stormwater <- stormwater %>%
  mutate(
    construction_material_group = case_when(
      construction_material_lupvalue %in% c(
        "In Situ Concrete",
        "Precast Concrete",
        "Concrete",
        "Cast Iron Concrete Infill",
        "Cmb Conc & Cast Iron"
      ) ~ "Concrete/Concrete Composite",
      
      construction_material_lupvalue == "Brick" ~ "Brick",
      
      construction_material_lupvalue %in% c(
        "Mild Steel",
        "Stainless Steel",
        "Cast Iron",
        "Galvanised Steel"
      ) ~ "Metal",
      
      construction_material_lupvalue == "Plastic" ~ "Plastic",
      
      construction_material_lupvalue == "Bluestone" ~ "Bluestone",
      
      construction_material_lupvalue == "Other" ~ "Other",
      
      construction_material_lupvalue %in% c("Not Known", "None") ~ "Unknown",
      
      is.na(construction_material_lupvalue) ~ "Missing",
      
      TRUE ~ "Other"
    )
  )

#validating coordinate boundaries for Greater Melbourne region
coord_outlier <- stormwater %>%
  filter(lat > -37.75 | lat < -37.85 | lon < 144.90 | lon > 145.02)

nrow(coord_outlier)
coord_outlier %>% select(asset_number, lat, lon) 



#checking the join compatibility of stormwater pits and the drainpipes datasets
pits_pipes <- unique(c(drainpipe$upstr_pit, drainpipe$dnstr_pit))
pits_pipes <- pits_pipes[!is.na(pits_pipes)]
  
match_rate <- mean(pits_pipes %in% stormwater$asset_number)
  percent(match_rate, accuracy = 0.1)



# checking the pit type composition 
stormwater %>%
  filter(
    !is.na(object_type_lupvalue),
    object_type_lupvalue != "Not Known",
    object_type_lupvalue != "Other"
  ) %>%
  count(object_type_lupvalue, sort = TRUE) %>%
  mutate(pct = percent(n / sum(n), accuracy = 0.1)) %>%
  ggplot(aes(x = fct_reorder(object_type_lupvalue, n), y = n)) +
  geom_col(fill = "steelblue") +
  coord_flip() +
  labs(title = "Stormwater Pit Network: Composition by Pit Type",
       x = NULL, y = "Number of Pits") +
  theme_minimal()

#checking onstruction material composition 
stormwater %>%
  filter(!construction_material_lupvalue %in% c("Not Known", "None") ,
         !is.na(construction_material_lupvalue)) %>%
  count(construction_material_lupvalue, sort = TRUE) %>%
  mutate(pct = percent(n / sum(n), accuracy = 0.1)) %>%
  ggplot(aes(x = fct_reorder(construction_material_lupvalue, n), y = n)) +
  geom_col(fill = "darkorange") +
  coord_flip() +
  labs(title = "Construction Material of Known-Material Pits",
       x = NULL, y = "Number of Pits") +
  theme_minimal()


#Check what pit types are most often built from which materials using a heatmap comparison
top_types <- stormwater %>% count(object_type_lupvalue, sort = TRUE) %>% slice_head(n = 8) %>% pull(object_type_lupvalue)
top_materials <- stormwater %>% count(construction_material_lupvalue, sort = TRUE) %>%
  filter(!construction_material_lupvalue %in% c("Not Known", "None")) %>%
  slice_head(n = 6) %>% pull(construction_material_lupvalue)

stormwater %>%
  filter(object_type_lupvalue %in% top_types, construction_material_lupvalue %in% top_materials) %>%
  count(object_type_lupvalue, construction_material_lupvalue) %>%
  ggplot(aes(x = object_type_lupvalue, y = construction_material_lupvalue, fill = n)) +
  geom_tile(color = "white") +
  scale_fill_gradient(low = "#f7fbff", high = "#08519c") +
  labs(title = "Pit Type vs Construction Material ",
       x = NULL, y = NULL, fill = "Count") +
  theme_minimal() +
  theme(axis.text.x = element_text(angle = 40, hjust = 1))



# Analyse the overflow kerb configuration where one exists
stormwater %>%
  count(overflow_kerb_lupvalue, sort = TRUE) %>%
  mutate(pct = percent(n / sum(n), accuracy = 0.1))

stormwater %>%
  filter(!overflow_kerb_lupvalue %in% c("None", "Not Known"), !is.na(overflow_kerb_lupvalue)) %>%
  count(overflow_kerb_lupvalue, sort = TRUE) %>%
  ggplot(aes(x = fct_reorder(overflow_kerb_lupvalue, n), y = n)) +
  geom_col(fill = "tomato") +
  coord_flip() +
  labs(title = "Type of Overflow Kerb",
       x = NULL, y = "Number of Pits") +
  theme_minimal()


#Check whether overflow kerb provision vary by pit type
stormwater %>%
  filter(object_type_lupvalue %in% top_types) %>%
  count(object_type_lupvalue, has_overflow = !overflow_kerb_lupvalue %in% c("None", "Not Known", NA)) %>%
  group_by(object_type_lupvalue) %>%
  mutate(pct = percent(n / sum(n), accuracy = 0.1)) %>%
  filter(has_overflow)

stormwater <- stormwater %>%
  filter(
    lat <= -37.75,
    lat >= -37.85,
    lon >= 144.90,
    lon <= 145.02
  )

# Overall spatial distribution of stormwater pits, coloured by pit type

#filtering out outlier corrdinates
stormwater <- stormwater %>%
  filter(
    lat <= -37.75,
    lat >= -37.85,
    lon >= 144.90,
    lon <= 145.02
  )

stormwater %>%
  filter(object_type_lupvalue %in% top_types) %>%
  ggplot(aes(x = lon, y = lat, color = object_type_lupvalue)) +
  geom_point(alpha = 0.6, size = 1) +
  scale_color_viridis_d(option = "turbo") +  
  coord_fixed(ratio = 1.3) +
  labs(title = "Spatial distribution of stormwater pits by type",
       x = "Longitude", y = "Latitude", color = "Pit type") +
  theme_minimal() 


leaflet(stormwater %>% sample_n(3000)) %>%   
  addProviderTiles(providers$CartoDB.Positron) %>%
  addCircleMarkers(lng = ~lon, lat = ~lat, radius = 1.5, stroke = FALSE,
                   fillColor = "steelblue", fillOpacity = 0.3) %>%
  addScaleBar(position = "bottomleft")


#write_csv(stormwater, "Stormwater_Pits_Cleaned.csv")

