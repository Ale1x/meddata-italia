package catalog

import (
	"encoding/json"
	"errors"
	"fmt"
	db "github.com/Ale1x/meddata-italia/db/generated"
	"github.com/Ale1x/meddata-italia/internal/platform"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type API struct {
	Queries        *db.Queries
	Logger         *slog.Logger
	Metrics        *platform.Metrics
	AllowedOrigins []string
}

func (a *API) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID, middleware.RealIP, middleware.Recoverer, middleware.Timeout(30*time.Second), a.cors, a.observability)
	r.Get("/health/live", func(w http.ResponseWriter, _ *http.Request) { writeJSON(w, 200, map[string]string{"status": "live"}) })
	r.Get("/health/ready", a.ready)
	r.Handle("/metrics", promhttp.Handler())
	r.Get("/openapi.yaml", openAPISpec)
	r.Get("/docs", swaggerDocs)
	r.Get("/docs/", swaggerDocs)
	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/official-equivalence/compare", a.compareOfficialEquivalence)
		r.Get("/medicines", a.listMedicines)
		r.Get("/medicines/{id}", a.getMedicine)
		r.Get("/packages/{id}", a.getPackage)
		r.Get("/packages/by-aic/{aic}", a.getPackageByAIC)
		r.Get("/packages/{id}/official-equivalents", a.officialEquivalents)
		r.Get("/active-substances", a.listActiveSubstances)
		r.Get("/active-substances/{id}", a.getActiveSubstance)
		r.Get("/active-substances/{id}/packages", a.packagesBySubstance)
		r.Get("/atc/{code}", a.getATC)
		r.Get("/shortages", a.listShortages)
		r.Get("/packages/{id}/shortages", a.packageShortages)
		r.Get("/ingestions/latest", a.latestIngestions)
		r.Get("/sources", a.listSources)
	})
	return otelhttp.NewHandler(r, "public-api")
}

func (a *API) cors(next http.Handler) http.Handler {
	allowed := make(map[string]struct{}, len(a.AllowedOrigins))
	for _, origin := range a.AllowedOrigins {
		allowed[origin] = struct{}{}
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if _, ok := allowed[origin]; ok {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, X-Request-ID")
			w.Header().Set("Access-Control-Expose-Headers", "X-Data-Observed-At, X-Data-Source, X-Request-ID")
			w.Header().Add("Vary", "Origin")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (a *API) compareOfficialEquivalence(w http.ResponseWriter, r *http.Request) {
	leftAIC, err := NormalizeAIC(r.URL.Query().Get("left_aic"))
	if err != nil {
		problem(w, 400, "invalid_left_aic", "left_aic must contain between 1 and 9 digits")
		return
	}
	rightAIC, err := NormalizeAIC(r.URL.Query().Get("right_aic"))
	if err != nil {
		problem(w, 400, "invalid_right_aic", "right_aic must contain between 1 and 9 digits")
		return
	}
	leftPackage, err := a.Queries.GetPackageByAIC(r.Context(), leftAIC)
	if errors.Is(err, pgx.ErrNoRows) {
		problem(w, 404, "left_package_not_found", "no package found for left_aic")
		return
	}
	if err != nil {
		dbProblem(w, err)
		return
	}
	rightPackage, err := a.Queries.GetPackageByAIC(r.Context(), rightAIC)
	if errors.Is(err, pgx.ErrNoRows) {
		problem(w, 404, "right_package_not_found", "no package found for right_aic")
		return
	}
	if err != nil {
		dbProblem(w, err)
		return
	}
	leftGroup, leftErr := a.Queries.GetOfficialGroupForPackage(r.Context(), leftPackage.ID)
	if leftErr != nil && !errors.Is(leftErr, pgx.ErrNoRows) {
		dbProblem(w, leftErr)
		return
	}
	rightGroup, rightErr := a.Queries.GetOfficialGroupForPackage(r.Context(), rightPackage.ID)
	if rightErr != nil && !errors.Is(rightErr, pgx.ErrNoRows) {
		dbProblem(w, rightErr)
		return
	}
	leftOfficial := leftErr == nil
	rightOfficial := rightErr == nil
	sameGroup := leftOfficial && rightOfficial && leftGroup.ID == rightGroup.ID
	reason := officialComparisonReason(leftOfficial, rightOfficial, sameGroup)
	left := map[string]any{"id": uuidString(leftPackage.ID), "aic": leftPackage.Aic, "name": leftPackage.Name, "description": leftPackage.Description, "official_group": nil}
	right := map[string]any{"id": uuidString(rightPackage.ID), "aic": rightPackage.Aic, "name": rightPackage.Name, "description": rightPackage.Description, "official_group": nil}
	var officialGroup any
	var freshnessMeta = map[string]any{}
	if leftOfficial {
		left["official_group"] = officialGroupMap(leftGroup)
		freshnessMeta = map[string]any{"source": leftGroup.SourceID, "published_date": date(leftGroup.PublishedDate)}
		w.Header().Set("X-Data-Source", leftGroup.SourceID)
	}
	if rightOfficial {
		right["official_group"] = officialGroupMap(rightGroup)
		if !leftOfficial {
			freshnessMeta = map[string]any{"source": rightGroup.SourceID, "published_date": date(rightGroup.PublishedDate)}
			w.Header().Set("X-Data-Source", rightGroup.SourceID)
		}
	}
	if sameGroup {
		officialGroup = officialGroupMap(leftGroup)
	}
	respond(w, r, map[string]any{
		"equivalent":            sameGroup,
		"semantics":             "AIFA_TRANSPARENCY_OFFICIAL",
		"reason":                reason,
		"left":                  left,
		"right":                 right,
		"shared_official_group": officialGroup,
	}, map[string]any{"data_freshness": freshnessMeta})
}

func officialGroupMap(group db.GetOfficialGroupForPackageRow) map[string]any {
	return map[string]any{
		"id": uuidString(group.ID), "authority": group.Authority, "source": group.SourceID,
		"source_group_identifier": group.SourceGroupIdentifier, "label": group.SourceGroupLabel,
		"published_date": date(group.PublishedDate), "valid_from": timestamp(group.ValidFrom), "valid_to": timestamp(group.ValidTo),
	}
}

func officialComparisonReason(leftOfficial, rightOfficial, sameGroup bool) string {
	switch {
	case sameGroup:
		return "SAME_OFFICIAL_GROUP"
	case !leftOfficial && !rightOfficial:
		return "NEITHER_IN_OFFICIAL_LIST"
	case !leftOfficial:
		return "LEFT_NOT_IN_OFFICIAL_LIST"
	case !rightOfficial:
		return "RIGHT_NOT_IN_OFFICIAL_LIST"
	default:
		return "DIFFERENT_OFFICIAL_GROUPS"
	}
}
func (a *API) ready(w http.ResponseWriter, r *http.Request) {
	ready, err := a.Queries.IsReady(r.Context())
	if err != nil || !ready {
		problem(w, 503, "not_ready", "database is reachable but catalog sources are not initialized")
		return
	}
	writeJSON(w, 200, map[string]string{"status": "ready"})
}
func (a *API) getPackageByAIC(w http.ResponseWriter, r *http.Request) {
	aic, err := NormalizeAIC(chi.URLParam(r, "aic"))
	if err != nil {
		problem(w, 400, "invalid_aic", err.Error())
		return
	}
	row, err := a.Queries.GetPackageByAIC(r.Context(), aic)
	if err != nil {
		dbProblem(w, err)
		return
	}
	data := packageMap(row.ID, row.Aic, row.MedicineID, row.Name, row.Description, row.FormID, row.FormName, row.RouteID, row.RouteName, row.HolderID, row.HolderName, row.AdministrativeStatus, row.SupplyRegime, row.ObservedAt)
	a.enrichPackage(r, data, row.ID)
	if strings.Contains(r.URL.Query().Get("include"), "provenance") {
		data["provenance"] = provenance(row.SourceID, row.ArtifactHash, row.PublishedAt, row.DownloadedAt, row.ObservedAt)
	}
	freshnessHeaders(w, row.SourceID, row.ObservedAt)
	respond(w, r, data, map[string]any{"data_freshness": freshness(row.SourceID, row.ObservedAt, row.PublishedAt)})
}
func (a *API) getPackage(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r)
	if !ok {
		return
	}
	row, err := a.Queries.GetPackageByID(r.Context(), id)
	if err != nil {
		dbProblem(w, err)
		return
	}
	data := packageMap(row.ID, row.Aic, row.MedicineID, row.Name, row.Description, row.FormID, row.FormName, row.RouteID, row.RouteName, row.HolderID, row.HolderName, row.AdministrativeStatus, row.SupplyRegime, row.ObservedAt)
	a.enrichPackage(r, data, row.ID)
	if strings.Contains(r.URL.Query().Get("include"), "provenance") {
		data["provenance"] = provenance(row.SourceID, row.ArtifactHash, row.PublishedAt, row.DownloadedAt, row.ObservedAt)
	}
	freshnessHeaders(w, row.SourceID, row.ObservedAt)
	respond(w, r, data, map[string]any{"data_freshness": freshness(row.SourceID, row.ObservedAt, row.PublishedAt)})
}
func (a *API) enrichPackage(r *http.Request, data map[string]any, id pgtype.UUID) {
	ingredients, err := a.Queries.ListPackageIngredients(r.Context(), id)
	if err == nil {
		items := make([]any, 0, len(ingredients))
		for _, v := range ingredients {
			items = append(items, map[string]any{"id": uuidString(v.ID), "name": v.DisplayName, "quantity": numeric(v.Quantity), "unit": nullableText(v.UnitNormalized), "quantity_raw": nullableText(v.QuantityRaw), "unit_raw": nullableText(v.UnitRaw)})
		}
		data["active_substances"] = items
	}
	atcs, err := a.Queries.ListPackageATC(r.Context(), id)
	if err == nil {
		data["atc"] = atcs
	}
	group, err := a.Queries.GetOfficialGroupForPackage(r.Context(), id)
	if err == nil {
		data["official_equivalence"] = map[string]any{"group_id": uuidString(group.ID), "authority": group.Authority, "source": group.SourceID, "source_group_identifier": group.SourceGroupIdentifier, "label": group.SourceGroupLabel, "published_date": date(group.PublishedDate), "valid_from": timestamp(group.ValidFrom), "valid_to": timestamp(group.ValidTo)}
	}
}
func (a *API) officialEquivalents(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r)
	if !ok {
		return
	}
	group, err := a.Queries.GetOfficialGroupForPackage(r.Context(), id)
	if err != nil {
		dbProblem(w, err)
		return
	}
	members, err := a.Queries.ListOfficialEquivalents(r.Context(), id)
	if err != nil {
		dbProblem(w, err)
		return
	}
	prices, _ := a.Queries.ListGroupPrices(r.Context(), group.ID)
	respond(w, r, map[string]any{"authority": group.Authority, "source": group.SourceID, "source_publication_date": date(group.PublishedDate), "group_source_identifier": group.SourceGroupIdentifier, "group_label": group.SourceGroupLabel, "group_validity": map[string]any{"from": timestamp(group.ValidFrom), "to": timestamp(group.ValidTo)}, "reference_prices": prices, "members": members, "artifact_hash": group.ArtifactHash}, map[string]any{"data_freshness": map[string]any{"published_date": date(group.PublishedDate), "source": group.SourceID}})
}
func (a *API) listMedicines(w http.ResponseWriter, r *http.Request) {
	limit, offset := pagination(r)
	rows, err := a.Queries.ListMedicines(r.Context(), db.ListMedicinesParams{Column1: r.URL.Query().Get("q"), Limit: int32(limit), Offset: int32(offset)})
	if err != nil {
		dbProblem(w, err)
		return
	}
	respond(w, r, rows, map[string]any{"limit": limit, "offset": offset})
}
func (a *API) getMedicine(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r)
	if !ok {
		return
	}
	row, err := a.Queries.GetMedicine(r.Context(), id)
	if err != nil {
		dbProblem(w, err)
		return
	}
	packages, _ := a.Queries.ListPackagesByMedicine(r.Context(), id)
	respond(w, r, map[string]any{"id": uuidString(row.ID), "source_product_code": row.SourceProductCode, "name": row.Name, "observed_at": timestamp(row.ObservedAt), "packages": packages}, nil)
}
func (a *API) listActiveSubstances(w http.ResponseWriter, r *http.Request) {
	limit, offset := pagination(r)
	rows, err := a.Queries.ListActiveSubstances(r.Context(), db.ListActiveSubstancesParams{Limit: int32(limit), Offset: int32(offset)})
	if err != nil {
		dbProblem(w, err)
		return
	}
	respond(w, r, rows, map[string]any{"limit": limit, "offset": offset})
}
func (a *API) getActiveSubstance(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r)
	if !ok {
		return
	}
	row, err := a.Queries.GetActiveSubstance(r.Context(), id)
	if err != nil {
		dbProblem(w, err)
		return
	}
	respond(w, r, row, nil)
}
func (a *API) packagesBySubstance(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r)
	if !ok {
		return
	}
	limit, offset := pagination(r)
	rows, err := a.Queries.ListPackagesByActiveSubstance(r.Context(), db.ListPackagesByActiveSubstanceParams{ActiveSubstanceID: id, Limit: int32(limit), Offset: int32(offset)})
	if err != nil {
		dbProblem(w, err)
		return
	}
	respond(w, r, rows, map[string]any{"limit": limit, "offset": offset})
}
func (a *API) getATC(w http.ResponseWriter, r *http.Request) {
	row, err := a.Queries.GetATC(r.Context(), strings.ToUpper(chi.URLParam(r, "code")))
	if err != nil {
		dbProblem(w, err)
		return
	}
	respond(w, r, row, nil)
}
func (a *API) listShortages(w http.ResponseWriter, r *http.Request) {
	limit, offset := pagination(r)
	rows, err := a.Queries.ListShortages(r.Context(), db.ListShortagesParams{Limit: int32(limit), Offset: int32(offset)})
	if err != nil {
		dbProblem(w, err)
		return
	}
	respond(w, r, rows, map[string]any{"limit": limit, "offset": offset})
}
func (a *API) packageShortages(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r)
	if !ok {
		return
	}
	rows, err := a.Queries.ListPackageShortages(r.Context(), id)
	if err != nil {
		dbProblem(w, err)
		return
	}
	respond(w, r, rows, nil)
}
func (a *API) latestIngestions(w http.ResponseWriter, r *http.Request) {
	rows, err := a.Queries.ListLatestIngestions(r.Context())
	if err != nil {
		dbProblem(w, err)
		return
	}
	respond(w, r, rows, nil)
}
func (a *API) listSources(w http.ResponseWriter, r *http.Request) {
	rows, err := a.Queries.ListSources(r.Context())
	if err != nil {
		dbProblem(w, err)
		return
	}
	respond(w, r, rows, nil)
}
func (a *API) observability(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
		next.ServeHTTP(ww, r)
		route := chi.RouteContext(r.Context()).RoutePattern()
		a.Metrics.HTTPRequests.WithLabelValues(r.Method, route, strconv.Itoa(ww.Status())).Inc()
		a.Metrics.HTTPDuration.WithLabelValues(r.Method, route).Observe(time.Since(start).Seconds())
		a.Logger.Info("http request", slog.String("request_id", middleware.GetReqID(r.Context())), slog.String("operation", r.Method+" "+route), slog.Int("status", ww.Status()), slog.Int64("duration_ms", time.Since(start).Milliseconds()))
	})
}
func packageMap(id pgtype.UUID, aic string, medicineID pgtype.UUID, name, description string, formID pgtype.UUID, formName pgtype.Text, routeID pgtype.UUID, routeName pgtype.Text, holderID pgtype.UUID, holderName, admin, supply pgtype.Text, observed pgtype.Timestamptz) map[string]any {
	return map[string]any{"id": uuidString(id), "aic": strings.TrimSpace(aic), "medicine": map[string]any{"id": uuidString(medicineID), "name": name}, "package_description": description, "pharmaceutical_form": optionalEntity(formID, formName), "administration_route": optionalEntity(routeID, routeName), "authorization_holder": optionalEntity(holderID, holderName), "administrative_status": nullableText(admin), "supply_regime": nullableText(supply), "observed_at": timestamp(observed), "active_substances": []any{}, "atc": []any{}}
}
func optionalEntity(id pgtype.UUID, name pgtype.Text) any {
	if !id.Valid || !name.Valid {
		return nil
	}
	return map[string]string{"id": uuidString(id), "name": name.String}
}
func provenance(source, hash pgtype.Text, published, downloaded, observed pgtype.Timestamptz) []any {
	return []any{map[string]any{"source": nullableText(source), "artifact_hash": nullableText(hash), "source_published_at": timestamp(published), "downloaded_at": timestamp(downloaded), "observed_at": timestamp(observed)}}
}
func freshness(source pgtype.Text, observed, published pgtype.Timestamptz) map[string]any {
	return map[string]any{"source": nullableText(source), "observed_at": timestamp(observed), "published_at": timestamp(published)}
}
func freshnessHeaders(w http.ResponseWriter, source pgtype.Text, observed pgtype.Timestamptz) {
	if source.Valid {
		w.Header().Set("X-Data-Source", source.String)
	}
	if observed.Valid {
		w.Header().Set("X-Data-Observed-At", observed.Time.Format(time.RFC3339))
	}
}
func respond(w http.ResponseWriter, r *http.Request, data, meta any) {
	w.Header().Set("X-Request-ID", middleware.GetReqID(r.Context()))
	if meta == nil {
		meta = map[string]any{}
	}
	m := meta.(map[string]any)
	m["request_id"] = middleware.GetReqID(r.Context())
	writeJSON(w, 200, map[string]any{"data": data, "meta": m})
}
func pathUUID(w http.ResponseWriter, r *http.Request) (pgtype.UUID, bool) {
	u, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		problem(w, 400, "invalid_id", "id must be a UUID")
		return pgtype.UUID{}, false
	}
	return pgtype.UUID{Bytes: u, Valid: true}, true
}
func pagination(r *http.Request) (int, int) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if limit < 1 || limit > 200 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}
	return limit, offset
}
func uuidString(v pgtype.UUID) string {
	if !v.Valid {
		return ""
	}
	return uuid.UUID(v.Bytes).String()
}
func nullableText(v pgtype.Text) any {
	if !v.Valid {
		return nil
	}
	return v.String
}
func timestamp(v pgtype.Timestamptz) any {
	if !v.Valid {
		return nil
	}
	return v.Time.Format(time.RFC3339)
}
func date(v pgtype.Date) any {
	if !v.Valid {
		return nil
	}
	return v.Time.Format("2006-01-02")
}
func numeric(v pgtype.Numeric) any {
	if !v.Valid {
		return nil
	}
	x, err := v.Float64Value()
	if err != nil || !x.Valid {
		return nil
	}
	return x.Float64
}
func dbProblem(w http.ResponseWriter, err error) {
	if errors.Is(err, pgx.ErrNoRows) {
		problem(w, 404, "not_found", "resource not found")
		return
	}
	problem(w, 500, "database_error", "database operation failed")
}
func problem(w http.ResponseWriter, status int, code, detail string) {
	writeJSON(w, status, map[string]any{"error": map[string]any{"code": code, "detail": detail}})
}
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		fmt.Fprintln(w, `{"error":{"code":"encoding_error"}}`)
	}
}
