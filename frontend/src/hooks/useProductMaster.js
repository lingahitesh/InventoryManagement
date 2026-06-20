import { useState, useEffect } from "react";
import { getProductTypes, getProductSubtypes } from "../api";

/**
 * Hook to load product types and subtypes from PRODUCT_MASTER.
 * When selectedType changes, subtypes are refetched for that type.
 * Returns: { types, subtypes, hasDimensions, loadingTypes, loadingSubtypes }
 */
export function useProductMaster(selectedType)
{
    const [typesRaw,        setTypesRaw]        = useState([]);
    const [subtypes,        setSubtypes]        = useState([]);
    const [loadingTypes,    setLoadingTypes]    = useState(true);
    const [loadingSubtypes, setLoadingSubtypes] = useState(false);

    // Load types once
    useEffect(() =>
    {
        setLoadingTypes(true);
        getProductTypes()
            .then(data => setTypesRaw(data))
            .catch(() => setTypesRaw([]))
            .finally(() => setLoadingTypes(false));
    }, []);

    // Load subtypes when type changes
    useEffect(() =>
    {
        if (!selectedType) { setSubtypes([]); return; }
        setLoadingSubtypes(true);
        getProductSubtypes(selectedType)
            .then(data => setSubtypes(data))
            .catch(() => setSubtypes([]))
            .finally(() => setLoadingSubtypes(false));
    }, [selectedType]);

    // Derive types list (strings) and hasDimensions flag for selected type
    const types = typesRaw.map(t => t.type);
    const hasDimensions = selectedType
        ? (typesRaw.find(t => t.type === selectedType)?.has_dimensions ?? true)
        : true;

    // Helper: given a display subtype string, return raw subtype
    const getRawSubtype = (displaySubtype) => {
        const trimmed = (displaySubtype || "").trim();
        const found = subtypes.find(s => s.display_subtype === trimmed);
        return found ? found.raw_subtype : trimmed;
    };

    return { types, subtypes, hasDimensions, getRawSubtype, loadingTypes, loadingSubtypes };
}
