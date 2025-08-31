@extends('backend.layouts.app')

@section('page-title', trans('app.general_settings'))
@section('page-heading', trans('app.general_settings'))

@section('content')

<section class="content-header">
	@include('backend.partials.messages')
</section>

<section class="content">

	<div class="box box-default">
		<form action="{{ route('backend.settings.list.update', 'categories') }}" method="POST" id="general-settings-form">
			@csrf
			<div class="box-header with-border">
				<h3 class="box-title">@lang('app.general_settings')</h3>
			</div>

			<div class="box-body">
				<div class="row">
					<div class="col-md-6">
						<div class="form-group">
							<label>
								@lang('app.use_all_categories')
							</label>
							<select name="use_all_categories" class="form-control">
								<option value="0" {{ settings('use_all_categories') == 0 ? 'selected' : '' }}>
									@lang('app.no')
								</option>
								<option value="1" {{ settings('use_all_categories') == 1 ? 'selected' : '' }}>
									@lang('app.yes')
								</option>
							</select>

						</div>

						<div class="form-group">
							<label>
								@lang('app.use_my_games')
							</label>
							<select name="use_my_games" class="form-control">
								<option value="0" {{ settings('use_my_games') == 0 ? 'selected' : '' }}>
									@lang('app.no')
								</option>
								<option value="1" {{ settings('use_my_games') == 1 ? 'selected' : '' }}>
									@lang('app.yes')
								</option>
							</select>
						</div>
					</div>
					<div class="col-md-6">
						<div class="form-group">
							<label>
								@lang('app.use_new_categories')
							</label>
							<select name="use_new_categories" class="form-control">
								<option value="0" {{ settings('use_new_categories') == 0 ? 'selected' : '' }}>
									@lang('app.no')
								</option>
								<option value="1" {{ settings('use_new_categories') == 1 ? 'selected' : '' }}>
									@lang('app.yes')
								</option>
							</select>
						</div>

						<div class="form-group">
							<label>
								@lang('app.use_hot_categories')
							</label>
							<select name="use_hot_categories" class="form-control">
								<option value="0" {{ settings('use_hot_categories') == 0 ? 'selected' : '' }}>
									@lang('app.no')
								</option>
								<option value="1" {{ settings('use_hot_categories') == 1 ? 'selected' : '' }}>
									@lang('app.yes')
								</option>
							</select>
						</div>
					</div>
				</div>
			</div>

			<div class="box-footer">
				<button type="submit" class="btn btn-primary">
					@lang('app.edit_settings')
				</button>



			</div>
		</form>
	</div>
</section>

@stop