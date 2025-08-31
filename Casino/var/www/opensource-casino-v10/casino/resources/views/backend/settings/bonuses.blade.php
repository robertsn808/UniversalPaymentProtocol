@extends('backend.layouts.app')

@section('page-title', trans('app.general_settings'))
@section('page-heading', trans('app.general_settings'))

@section('content')

<section class="content-header">
	@include('backend.partials.messages')
</section>

<section class="content">

	<div class="box box-default">
		<form action="{{ route('backend.settings.list.update', 'bonuses') }}" method="POST" id="general-settings-form">
			@csrf
			<div class="box-header with-border">
				<h3 class="box-title">@lang('app.general_settings')</h3>
			</div>

			<div class="box-body">
				<div class="row">
					<div class="col-md-6">

						<div class="form-group">
							<label>
								@lang('app.happyhours')
							</label>
							<select name="happyhours_active" class="form-control">
								<option value="0" {{ auth()->user()->shop && auth()->user()->shop->happyhours_active == 0 ? 'selected' : '' }}>
									@lang('app.no')
								</option>
								<option value="1" {{ auth()->user()->shop && auth()->user()->shop->happyhours_active == 1 ? 'selected' : '' }}>
									@lang('app.yes')
								</option>
							</select>
						</div>

						<div class="form-group">
							<label>
								@lang('app.progress')
							</label>
							<select name="progress_active" class="form-control">
								<option value="0" {{ settings('progress_active') == 0 ? 'selected' : '' }}>
									@lang('app.no')
								</option>
								<option value="1" {{ settings('progress_active') == 1 ? 'selected' : '' }}>
									@lang('app.yes')
								</option>
							</select>
						</div>

						<div class="form-group">
							<label>
								@lang('app.invite')
							</label>
							<select name="invite_active" class="form-control">
								<option value="0" {{ settings('invite_active') == 0 ? 'selected' : '' }}>
									@lang('app.no')
								</option>
								<option value="1" {{ settings('invite_active') == 1 ? 'selected' : '' }}>
									@lang('app.yes')
								</option>
							</select>
						</div>

					</div>
					<div class="col-md-6">

						<div class="form-group">
							<label>
								@lang('app.welcome_bonuses')
							</label>
							<select name="welcome_bonuses_active" class="form-control">
								<option value="0" {{ settings('welcome_bonuses_active') == 0 ? 'selected' : '' }}>
									@lang('app.no')
								</option>
								<option value="1" {{ settings('welcome_bonuses_active') == 1 ? 'selected' : '' }}>
									@lang('app.yes')
								</option>
							</select>
						</div>

						<div class="form-group">
							<label>
								@lang('app.sms_bonuses')
							</label>
							<select name="sms_bonuses_active" class="form-control">
								<option value="0" {{ settings('sms_bonuses_active') == 0 ? 'selected' : '' }}>
									@lang('app.no')
								</option>
								<option value="1" {{ settings('sms_bonuses_active') == 1 ? 'selected' : '' }}>
									@lang('app.yes')
								</option>
							</select>
						</div>

						<div class="form-group">
							<label>
								@lang('app.wheelfortune')
							</label>
							<select name="wheelfortune_active" class="form-control">
								<option value="0" {{ settings('wheelfortune_active') == 0 ? 'selected' : '' }}>
									@lang('app.no')
								</option>
								<option value="1" {{ settings('wheelfortune_active') == 1 ? 'selected' : '' }}>
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